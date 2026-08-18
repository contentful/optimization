import {
  expect,
  test,
  type APIResponse,
  type Page,
  type Request,
  type Route,
  type TestInfo,
} from '@playwright/test'
import { CUSTOMER_SEGMENTS, PAGES } from '../src/fixtures'
import { hasFlag, implementation } from './utils'

const segment = CUSTOMER_SEGMENTS['new-visitor']
const EVIDENCE_KEY = '__ctflReadinessEvidence'
const EXPERIENCE_ROUTE = '**/experience/**'
const diagnosticsByPage = new WeakMap<Page, Diagnostics>()
const pagesCsrTest =
  hasFlag('CSR') && implementation === 'nextjs-sdk_pages-router' ? test : test.skip
const pagesSsrTest =
  hasFlag('SSR') && implementation === 'nextjs-sdk_pages-router' ? test : test.skip
const reactCsrTest = hasFlag('CSR') && implementation === 'react-web-sdk' ? test : test.skip
const webComponentCsrTest = hasFlag('CSR') && implementation === 'web-sdk' ? test : test.skip

interface Candidate {
  readonly contentEntryId: string | null
  readonly text: string
  readonly tracking: {
    readonly baselineId: string | null
    readonly entryId: string | null
    readonly optimizationId: string | null
    readonly variantIndex: string | null
  }
}

interface Evidence {
  readonly secondVisibleCandidateAfterCommitment: boolean
  readonly visibleBlankContentAfterCommitment: boolean
  readonly visibility: ReadonlyArray<{
    readonly contentVisible: boolean
    readonly documentReadyState: DocumentReadyState
    readonly loaderVisible: boolean
  }>
  readonly visibleCandidates: readonly Candidate[]
}

interface Diagnostics {
  readonly consoleErrors: string[]
  readonly hydrationErrors: string[]
  readonly pageErrors: string[]
}

function watchDiagnostics(page: Page): Diagnostics {
  const result: Diagnostics = { consoleErrors: [], hydrationErrors: [], pageErrors: [] }
  diagnosticsByPage.set(page, result)
  page.on('console', (message) => {
    const text = `[${message.type()}] ${message.text()}`
    if (message.type() === 'error') result.consoleErrors.push(text)
    if (/hydrat|server html|did not match/i.test(text)) result.hydrationErrors.push(text)
  })
  page.on('pageerror', (error) => result.pageErrors.push(error.message))
  return result
}

async function observeFromDocumentStart(
  page: Page,
  contentSelector: string,
  loaderSelector?: string,
): Promise<void> {
  await page.addInitScript(
    ({ contentSelector, key, loaderSelector }) => {
      const visibleCandidates: Candidate[] = []
      const visibility: Array<{
        contentVisible: boolean
        documentReadyState: DocumentReadyState
        loaderVisible: boolean
      }> = []
      const signatures = new Set<string>()
      const evidence = {
        secondVisibleCandidateAfterCommitment: false,
        visibleBlankContentAfterCommitment: false,
        visibility,
        visibleCandidates,
      }
      const isConcealed = (element: HTMLElement): boolean => {
        const style = getComputedStyle(element)
        return (
          element.hidden ||
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.visibility === 'collapse' ||
          style.opacity === '0'
        )
      }
      const isVisible = (element: Element | null): element is HTMLElement => {
        if (!(element instanceof HTMLElement) || !element.isConnected) return false
        for (let node: HTMLElement | null = element; node !== null; node = node.parentElement) {
          if (isConcealed(node)) return false
        }
        const boxes = [element, ...Array.from(element.querySelectorAll<HTMLElement>('*'))]
        return boxes.some((box) => {
          for (let node: HTMLElement | null = box; node !== element; node = node.parentElement) {
            if (node === null) return false
            if (isConcealed(node)) return false
          }
          return box.getClientRects().length > 0
        })
      }
      const sample = (): void => {
        const content = document.querySelector(contentSelector)
        const loader = loaderSelector ? document.querySelector(loaderSelector) : null
        if (content === null && loader === null) return
        const state = {
          contentVisible: isVisible(content),
          documentReadyState: document.readyState,
          loaderVisible: isVisible(loader),
        }
        const previous = visibility.at(-1)
        if (
          previous?.contentVisible !== state.contentVisible ||
          previous.loaderVisible !== state.loaderVisible
        ) {
          visibility.push(state)
        }
        if (!state.contentVisible || content === null) return
        const contentOwner =
          content.closest('[data-test-entry-id]') ?? content.querySelector('[data-test-entry-id]')
        const tracking =
          content.closest('[data-ctfl-baseline-id]') ??
          content.querySelector('[data-ctfl-baseline-id]')
        const candidate: Candidate = {
          contentEntryId: contentOwner?.getAttribute('data-test-entry-id') ?? null,
          text: content.textContent.replace(/\s+/g, ' ').trim(),
          tracking: {
            baselineId: tracking?.getAttribute('data-ctfl-baseline-id') ?? null,
            entryId: tracking?.getAttribute('data-ctfl-entry-id') ?? null,
            optimizationId: tracking?.getAttribute('data-ctfl-optimization-id') ?? null,
            variantIndex: tracking?.getAttribute('data-ctfl-variant-index') ?? null,
          },
        }
        const signature = JSON.stringify(candidate)
        if (candidate.text === '') {
          if (visibleCandidates.length > 0) {
            evidence.visibleBlankContentAfterCommitment = true
          }
          return
        }
        if (signatures.has(signature)) return
        signatures.add(signature)
        evidence.secondVisibleCandidateAfterCommitment = visibleCandidates.length > 0
        visibleCandidates.push(candidate)
      }
      Reflect.set(window, key, evidence)
      new MutationObserver(sample).observe(document, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true,
      })
      sample()
    },
    { contentSelector, key: EVIDENCE_KEY, loaderSelector },
  )
}

async function readEvidence(page: Page): Promise<Evidence> {
  const value: unknown = await page.evaluate(
    (key): unknown => Reflect.get(window, key),
    EVIDENCE_KEY,
  )
  if (!isEvidence(value)) throw new Error('Document-start readiness evidence was not installed.')
  return value
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null
}

function isEvidence(value: unknown): value is Evidence {
  return (
    isRecord(value) &&
    typeof value.secondVisibleCandidateAfterCommitment === 'boolean' &&
    typeof value.visibleBlankContentAfterCommitment === 'boolean' &&
    Array.isArray(value.visibility) &&
    Array.isArray(value.visibleCandidates)
  )
}

function containsEvent(request: Request, type: 'identify' | 'page'): boolean {
  try {
    const payload: unknown = request.postDataJSON()
    return (
      isRecord(payload) &&
      Array.isArray(payload.events) &&
      payload.events.some((event) => isRecord(event) && event.type === type)
    )
  } catch {
    return false
  }
}

interface HeldResponse {
  readonly held: () => boolean
  readonly release: () => void
  readonly remove: () => Promise<void>
}

interface TrackedRouteHandler {
  readonly drain: () => Promise<void>
  readonly handler: (route: Route) => Promise<void>
}

function trackRouteHandler(handle: (route: Route) => Promise<void>): TrackedRouteHandler {
  const active = new Set<Promise<void>>()
  const handler = async (route: Route): Promise<void> => {
    const operation = handle(route)
    active.add(operation)
    void operation.then(
      () => active.delete(operation),
      () => active.delete(operation),
    )
    await operation
  }
  return {
    drain: async () => {
      await Promise.allSettled([...active])
    },
    handler,
  }
}

async function holdExistingResponse(page: Page, type: 'identify' | 'page'): Promise<HeldResponse> {
  let held = false
  let removed = false
  let release = (): void => undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const tracked = trackRouteHandler(async (route): Promise<void> => {
    if (held || !containsEvent(route.request(), type)) {
      await route.continue()
      return
    }
    const response = await route.fetch()
    held = true
    await gate
    await route.fulfill({ response })
  })
  await page.route(EXPERIENCE_ROUTE, tracked.handler)
  return {
    held: () => held,
    release,
    remove: async (): Promise<void> => {
      if (removed) return
      removed = true
      release()
      await tracked.drain()
      await page.unroute(EXPERIENCE_ROUTE, tracked.handler)
      await tracked.drain()
    },
  }
}

interface FailedRequest {
  readonly failed: () => boolean
  readonly remove: () => Promise<void>
}

async function failNextRequest(page: Page, type: 'identify' | 'page'): Promise<FailedRequest> {
  let claimed = false
  let failed = false
  const tracked = trackRouteHandler(async (route): Promise<void> => {
    if (claimed || !containsEvent(route.request(), type)) {
      await route.continue()
      return
    }
    claimed = true
    await route.abort('failed')
    failed = true
  })
  await page.route(EXPERIENCE_ROUTE, tracked.handler)
  return {
    failed: () => failed,
    remove: async () => {
      await tracked.drain()
      await page.unroute(EXPERIENCE_ROUTE, tracked.handler)
      await tracked.drain()
    },
  }
}

interface FailedResponseReplay {
  readonly firstFailed: () => boolean
  readonly remove: () => Promise<void>
  readonly replayed: () => boolean
}

async function failFirstPageThenReplay(page: Page): Promise<FailedResponseReplay> {
  let capturedResponse: APIResponse | undefined
  let capturingFirstPage = false
  let firstFailed = false
  let replayed = false
  const tracked = trackRouteHandler(async (route): Promise<void> => {
    if (!replayed && capturedResponse !== undefined && containsEvent(route.request(), 'identify')) {
      await route.fulfill({ response: capturedResponse })
      replayed = true
      return
    }
    if (containsEvent(route.request(), 'page')) {
      if (capturingFirstPage) {
        await route.abort('failed')
        return
      }
      capturingFirstPage = true
      const response = await route.fetch()
      if (!response.ok()) {
        throw new Error('Captured Experience page response was not successful.')
      }
      capturedResponse = response
      await route.abort('failed')
      firstFailed = true
      return
    }
    await route.continue()
  })
  await page.route(EXPERIENCE_ROUTE, tracked.handler)
  return {
    firstFailed: () => firstFailed,
    replayed: () => replayed,
    remove: async () => {
      await tracked.drain()
      await page.unroute(EXPERIENCE_ROUTE, tracked.handler)
      await tracked.drain()
    },
  }
}

function expectRawHidden(html: string, testId: string, hidden: boolean): void {
  const tag = new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0]
  expect(tag, `raw HTML should contain ${testId}`).toBeDefined()
  expect(/\shidden(?:=""|(?=\s|>))/.test(tag ?? '')).toBe(hidden)
}

function expectCandidate(candidate: Candidate, entryId?: string): void {
  expect(candidate.contentEntryId).toBeTruthy()
  if (entryId !== undefined) expect(candidate.contentEntryId).toBe(entryId)
  expect(candidate.tracking.entryId).toBe(candidate.contentEntryId)
  expect(candidate.tracking.baselineId).toBe(segment.baselineEntryId)
}

function candidateAt(evidence: Evidence, index = 0): Candidate {
  return evidence.visibleCandidates[index]
}

function expectNewVisitor(candidate: Candidate): void {
  expectCandidate(candidate, segment.variantEntryId)
  expect(candidate.text).toContain(segment.resolvedEntryText)
  expect(candidate.tracking.optimizationId).toBe(segment.experienceId)
  expect(candidate.tracking.variantIndex).toBe('1')
}

function expectBaseline(candidate: Candidate): void {
  expectCandidate(candidate, segment.baselineEntryId)
  expect(candidate.tracking.optimizationId).toBeNull()
  expect(candidate.tracking.variantIndex).toBe('0')
}

function expectBaselineOrNewVisitor(candidate: Candidate): void {
  if (candidate.contentEntryId === segment.baselineEntryId) {
    expectBaseline(candidate)
    return
  }
  expectNewVisitor(candidate)
}

function expectLoadingFirst(evidence: Evidence, requireBeforeComplete = false): void {
  expect(evidence.visibility[0]).toMatchObject({ contentVisible: false, loaderVisible: true })
  if (requireBeforeComplete) {
    expect(evidence.visibility[0].documentReadyState).not.toBe('complete')
  }
}

function expectPreservedFirst(evidence: Evidence): void {
  expect(evidence.visibility[0]).toMatchObject({ contentVisible: true, loaderVisible: false })
  expect(evidence.visibility[0].documentReadyState).not.toBe('complete')
}

function expectContinuouslyVisible(evidence: Evidence, afterCommitment = false): void {
  const firstSample = afterCommitment
    ? evidence.visibility.findIndex(({ contentVisible }) => contentVisible)
    : 0
  expect(firstSample).toBeGreaterThanOrEqual(0)
  expect(
    evidence.visibility
      .slice(firstSample)
      .every(({ contentVisible, loaderVisible }) => contentVisible && !loaderVisible),
  ).toBe(true)
}

function expectNoVisibleBlankAfterCommitment(evidence: Evidence): void {
  expect(evidence.visibleBlankContentAfterCommitment).toBe(false)
}

function expectNoErrors(diagnostics: Diagnostics): void {
  expect(diagnostics).toEqual({ consoleErrors: [], hydrationErrors: [], pageErrors: [] })
}

function expectOnlyIntentionalRequestErrors(diagnostics: Diagnostics): void {
  expect(diagnostics.hydrationErrors).toEqual([])
  const requestErrors = [...diagnostics.consoleErrors, ...diagnostics.pageErrors]
  expect(requestErrors.length).toBeGreaterThan(0)
  for (const error of requestErrors) {
    expect(error).toMatch(/abort|fetch|resource|network|experience|net::err/i)
  }
}

async function attachRawHtml(testInfo: TestInfo, rawHtml: string): Promise<void> {
  await testInfo.attach(`${testInfo.title}-raw-response.html`, {
    body: rawHtml,
    contentType: 'text/html',
  })
}

async function attachTerminalEvidence(testInfo: TestInfo, page: Page): Promise<void> {
  const diagnostics = diagnosticsByPage.get(page)
  if (diagnostics === undefined) return
  let evidence: Evidence | undefined
  let evidenceError: string | undefined
  try {
    evidence = await readEvidence(page)
  } catch (error: unknown) {
    evidenceError = error instanceof Error ? error.message : String(error)
  }
  await testInfo.attach(`${testInfo.title}-readiness.json`, {
    body: JSON.stringify({ diagnostics, evidence, evidenceError }, null, 2),
    contentType: 'application/json',
  })
}

test.describe('readiness', () => {
  test.afterEach(async ({ page }, testInfo) => {
    await attachTerminalEvidence(testInfo, page)
  })

  pagesCsrTest('personalized shared SSG', async ({ page, request }, testInfo) => {
    const diagnostics = watchDiagnostics(page)
    const path = '/ssg-client-personalization'
    const response = await request.get(path)
    const rawHtml = await response.text()
    await attachRawHtml(testInfo, rawHtml)
    expect(response.ok()).toBe(true)
    expectRawHidden(rawHtml, 'readiness-ssg-entry', true)
    expectRawHidden(rawHtml, 'readiness-ssg-loading', false)
    expect(rawHtml).toContain(segment.baselineEntryId)
    await observeFromDocumentStart(
      page,
      '[data-testid="readiness-ssg-entry"]',
      '[data-testid="readiness-ssg-loading"]',
    )
    await page.goto(path)
    await page.getByTestId('readiness-ssg-entry').waitFor({ state: 'visible' })
    await expect(page.getByTestId('readiness-ssg-loading')).toBeHidden()
    await expect(page.getByTestId('link-ssg-client-personalization')).toHaveAttribute('href', path)
    const evidence = await readEvidence(page)
    expectLoadingFirst(evidence, true)
    expect(evidence.visibleCandidates).toHaveLength(1)
    expectNewVisitor(candidateAt(evidence))
    expect(evidence.secondVisibleCandidateAfterCommitment).toBe(false)
    expectNoVisibleBlankAfterCommitment(evidence)
    expectNoErrors(diagnostics)
  })

  reactCsrTest('unseeded CSR', async ({ page }) => {
    const diagnostics = watchDiagnostics(page)
    const response = await holdExistingResponse(page, 'page')
    try {
      await observeFromDocumentStart(
        page,
        '[data-testid="entry-text-live-default"]',
        '[data-testid="sdk-loading"], [data-testid="home-loading"]',
      )
      await page.goto(PAGES.home.path)
      await expect.poll(response.held).toBe(true)
      const loading = await readEvidence(page)
      expectLoadingFirst(loading)
      expect(loading.visibleCandidates).toEqual([])
      response.release()
      await expect(page.getByTestId('entry-text-live-default')).toBeVisible()
      const evidence = await readEvidence(page)
      expect(evidence.visibleCandidates).toHaveLength(1)
      const candidate = candidateAt(evidence)
      expectBaselineOrNewVisitor(candidate)
      expectContinuouslyVisible(evidence, true)
      expect(evidence.secondVisibleCandidateAfterCommitment).toBe(false)
      expectNoVisibleBlankAfterCommitment(evidence)
      expectNoErrors(diagnostics)
    } finally {
      await response.remove()
    }
  })

  pagesSsrTest('exact request SSR', async ({ page, request }, testInfo) => {
    const diagnostics = watchDiagnostics(page)
    const response = await request.get(PAGES.pageTwo.path)
    const rawHtml = await response.text()
    await attachRawHtml(testInfo, rawHtml)
    expect(response.ok()).toBe(true)
    expect(rawHtml).toContain(segment.resolvedEntryText)
    await observeFromDocumentStart(page, `[data-testid="entry-text-${PAGES.pageTwo.auto}"]`)
    await page.goto(PAGES.pageTwo.path)
    await expect(page.getByTestId('page-two-view')).toBeVisible()
    const evidence = await readEvidence(page)
    expectPreservedFirst(evidence)
    expectContinuouslyVisible(evidence)
    expect(evidence.visibleCandidates).toHaveLength(1)
    expectNewVisitor(candidateAt(evidence))
    expect(evidence.secondVisibleCandidateAfterCommitment).toBe(false)
    expectNoVisibleBlankAfterCommitment(evidence)
    expectNoErrors(diagnostics)
  })

  pagesSsrTest('preserved public-permutation ISR', async ({ page, request }, testInfo) => {
    const diagnostics = watchDiagnostics(page)
    const path = `/selection-handoff/${segment.slug}`
    const response = await request.get(path)
    const rawHtml = await response.text()
    await attachRawHtml(testInfo, rawHtml)
    expect(response.ok()).toBe(true)
    expect(response.headers()['cache-control']).toContain('s-maxage=60')
    expect(rawHtml).toContain(segment.resolvedEntryText)
    await observeFromDocumentStart(
      page,
      `[data-testid="entry-text-pages-selection-${segment.baselineEntryId}"]`,
    )
    await page.goto(path)
    await expect(page.getByTestId('pages-selection-handoff-route')).toBeVisible()
    const evidence = await readEvidence(page)
    expectPreservedFirst(evidence)
    expectContinuouslyVisible(evidence)
    expect(evidence.visibleCandidates).toHaveLength(1)
    expectNewVisitor(candidateAt(evidence))
    expect(evidence.secondVisibleCandidateAfterCommitment).toBe(false)
    expectNoVisibleBlankAfterCommitment(evidence)
    expectNoErrors(diagnostics)
  })

  reactCsrTest('timeout/failure then late response', async ({ page }) => {
    const diagnostics = watchDiagnostics(page)
    const response = await failFirstPageThenReplay(page)
    try {
      await observeFromDocumentStart(
        page,
        '[data-testid="entry-text-live-default"]',
        '[data-testid="sdk-loading"], [data-testid="home-loading"]',
      )
      await page.goto(PAGES.home.path)
      await expect.poll(response.firstFailed).toBe(true)
      await expect
        .poll(async () => (await readEvidence(page)).visibleCandidates.length, { timeout: 8000 })
        .toBe(1)
      const fallback = candidateAt(await readEvidence(page))
      expectBaseline(fallback)
      await expect(page.getByTestId('selected-optimizations-count')).toHaveText('0')
      await page.getByTestId('identify-button').click()
      await expect.poll(response.replayed).toBe(true)
      await expect
        .poll(async () =>
          Number(await page.getByTestId('selected-optimizations-count').innerText()),
        )
        .toBeGreaterThan(0)
      const evidence = await readEvidence(page)
      expectLoadingFirst(evidence)
      expectContinuouslyVisible(evidence, true)
      expect(evidence.visibleCandidates).toEqual([fallback])
      expect(evidence.secondVisibleCandidateAfterCommitment).toBe(false)
      expectNoVisibleBlankAfterCommitment(evidence)
      expectOnlyIntentionalRequestErrors(diagnostics)
    } finally {
      await response.remove()
    }
  })

  reactCsrTest('explicit live updates', async ({ page }) => {
    const diagnostics = watchDiagnostics(page)
    await observeFromDocumentStart(
      page,
      '[data-testid="entry-text-live-enabled"]',
      '[data-testid="sdk-loading"], [data-testid="home-loading"]',
    )
    await page.goto(PAGES.home.path)
    await expect.poll(async () => (await readEvidence(page)).visibleCandidates.length).toBe(1)
    const initial = candidateAt(await readEvidence(page))
    expectNewVisitor(initial)
    const response = await holdExistingResponse(page, 'identify')
    try {
      await page.getByTestId('identify-button').click()
      await expect.poll(response.held).toBe(true)
      const pending = await readEvidence(page)
      expect(pending.visibleCandidates).toEqual([initial])
      expectContinuouslyVisible(pending, true)
      response.release()
      await expect.poll(async () => (await readEvidence(page)).visibleCandidates.length).toBe(2)
      await page.getByTestId('reset-button').click()
      await expect(page.getByTestId('identify-button')).toBeVisible()
      const evidence = await readEvidence(page)
      expectLoadingFirst(evidence)
      expectContinuouslyVisible(evidence, true)
      const replacement = candidateAt(evidence, 1)
      expectCandidate(replacement)
      expect(replacement.contentEntryId).not.toBe(initial.contentEntryId)
      expect(replacement.tracking.optimizationId).not.toBeNull()
      expect(Number(replacement.tracking.variantIndex)).toBeGreaterThan(0)
      expect(evidence.visibleCandidates).toHaveLength(2)
      expect(evidence.secondVisibleCandidateAfterCommitment).toBe(true)
      expectNoVisibleBlankAfterCommitment(evidence)
      expectNoErrors(diagnostics)

      await response.remove()
      const failure = await failNextRequest(page, 'identify')
      try {
        await page.getByTestId('identify-button').click()
        await expect.poll(failure.failed).toBe(true)
        await expect
          .poll(() => diagnostics.consoleErrors.length, { timeout: 8000 })
          .toBeGreaterThan(0)

        const failedEvidence = await readEvidence(page)
        expectLoadingFirst(failedEvidence)
        expectContinuouslyVisible(failedEvidence, true)
        expect(failedEvidence.visibleCandidates).toEqual([initial, replacement])
        expect(failedEvidence.secondVisibleCandidateAfterCommitment).toBe(true)
        expectNoVisibleBlankAfterCommitment(failedEvidence)
        expectOnlyIntentionalRequestErrors(diagnostics)
      } finally {
        await failure.remove()
      }
    } finally {
      await response.remove()
    }
  })

  webComponentCsrTest('producer-hidden Web Component', async ({ page, request }, testInfo) => {
    const diagnostics = watchDiagnostics(page)
    const response = await request.get(PAGES.home.path)
    const rawHtml = await response.text()
    await attachRawHtml(testInfo, rawHtml)
    expect(response.ok()).toBe(true)
    expectRawHidden(rawHtml, 'readiness-web-component-entry', true)
    expectRawHidden(rawHtml, 'readiness-web-component-loading', false)
    await observeFromDocumentStart(
      page,
      '[data-testid="readiness-web-component-entry"]',
      '[data-testid="readiness-web-component-loading"]',
    )
    await page.goto(PAGES.home.path)
    await expect(page.getByTestId('readiness-web-component-loading')).toBeHidden()
    await expect(page.getByTestId('readiness-web-component-entry')).not.toHaveAttribute(
      'hidden',
      '',
    )
    const evidence = await readEvidence(page)
    expectLoadingFirst(evidence, true)
    expect(evidence.visibleCandidates).toHaveLength(1)
    expectNewVisitor(candidateAt(evidence))
    expect(evidence.secondVisibleCandidateAfterCommitment).toBe(false)
    expectNoVisibleBlankAfterCommitment(evidence)
    expectNoErrors(diagnostics)
  })
})
