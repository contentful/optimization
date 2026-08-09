import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { CUSTOMER_SEGMENTS, PAGES } from '../src/fixtures'
import { runIf, runIfImplementation } from './utils'

const newVisitorSegment = CUSTOMER_SEGMENTS['new-visitor']
const baselineSegment = CUSTOMER_SEGMENTS.baseline
const publicPermutationSegments = [newVisitorSegment, baselineSegment] as const

type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[keyof typeof CUSTOMER_SEGMENTS]
type CustomerSegmentSelection = CustomerSegment['selectedOptimizations'][number]

interface PublicCacheMetadata {
  readonly key: string
  readonly scope: 'public-permutation'
  readonly tags?: readonly string[]
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null
}

function isPublicCacheMetadata(value: unknown): value is PublicCacheMetadata {
  if (!isRecord(value)) return false
  const { key, scope, tags } = value

  return (
    typeof key === 'string' &&
    scope === 'public-permutation' &&
    (tags === undefined || (Array.isArray(tags) && tags.every((tag) => typeof tag === 'string')))
  )
}

function readPublicCacheMetadata(payload: unknown): PublicCacheMetadata {
  if (!isRecord(payload) || !isPublicCacheMetadata(payload.cache)) {
    throw new Error('Edge runtime selection response did not include public cache metadata.')
  }

  return payload.cache
}

interface EdgeRuntimePayload {
  readonly runtime: {
    readonly isEdgeRuntime: true
    readonly witness: 'edge-runtime'
  }
}

function expectPublicCacheMiddlewareRewrite({
  cacheKey,
  path,
  responseHeaders,
}: {
  readonly cacheKey: string
  readonly path: string
  readonly responseHeaders: Readonly<Record<string, string | undefined>>
}): void {
  const rewriteHeader = responseHeaders['x-middleware-rewrite']
  expect(rewriteHeader).toBeTruthy()

  const rewriteUrl = new URL(rewriteHeader ?? '/', 'http://middleware.invalid')
  const requestedUrl = new URL(path, rewriteUrl.origin)
  expect(rewriteUrl.pathname).toBe(requestedUrl.pathname)
  expect(rewriteUrl.searchParams.get('ctfl-opt-cache-key')).toBe(cacheKey)
}

async function expectRawHiddenUntilReadyHtml(page: Page, html: string): Promise<void> {
  const snapshot = await page.evaluate((rawHtml) => {
    const doc = new DOMParser().parseFromString(rawHtml, 'text/html')
    const content = doc.querySelector('[data-testid="content-hidden-until-ready"]')
    const loadingTarget = content?.closest('[data-ctfl-loading-layout-target="true"]')

    return {
      hasContent: content !== null,
      hasRoute: doc.querySelector('[data-testid="hidden-until-ready-route"]') !== null,
      isHiddenByLoadingTarget:
        loadingTarget instanceof HTMLElement && loadingTarget.style.visibility === 'hidden',
      isHiddenByStreamedSegment: content?.closest('[hidden]') !== null,
    }
  }, html)

  expect(snapshot.hasRoute).toBe(true)

  if (!snapshot.hasContent) {
    expect(snapshot.hasContent).toBe(false)
    return
  }

  expect(snapshot.isHiddenByLoadingTarget || snapshot.isHiddenByStreamedSegment).toBe(true)
}

async function expectPageTwoSelectedVariant(page: Page): Promise<void> {
  const host = page.locator(`[data-ctfl-baseline-id="${PAGES.pageTwo.auto}"]`).first()
  await expect(host).toHaveAttribute('data-ctfl-entry-id', newVisitorSegment.variantEntryId)
  await expect(host).toHaveAttribute('data-ctfl-optimization-id', newVisitorSegment.experienceId)
  await expect(host).toHaveAttribute('data-ctfl-variant-index', '1')
}

async function expectRawSelectedHandoffHtml({
  cacheKeyTestId,
  expectedCacheControl,
  path,
  request,
  routeTestId,
  segment = newVisitorSegment,
}: {
  readonly cacheKeyTestId: string
  readonly expectedCacheControl?: string
  readonly path: string
  readonly request: APIRequestContext
  readonly routeTestId: string
  readonly segment?: CustomerSegment
}): Promise<{ readonly cacheMetadata: PublicCacheMetadata; readonly html: string }> {
  const response = await request.get(path)
  const responseHeaders = response.headers()
  const html = await response.text()
  const cacheKey = readHtmlTestIdText(html, cacheKeyTestId)
  const cacheMetadata = {
    key: cacheKey,
    scope: 'public-permutation',
  } satisfies PublicCacheMetadata

  expect(response.ok()).toBe(true)
  if (expectedCacheControl !== undefined) {
    expect(responseHeaders['cache-control']).toContain(expectedCacheControl)
  }
  expectPublicCacheMiddlewareRewrite({ cacheKey, path, responseHeaders })
  expect(html).toContain(`data-testid="${routeTestId}"`)
  expect(html).toContain(`data-testid="${cacheKeyTestId}"`)
  expect(html).toContain(segment.resolvedEntryText)
  expectSelectedEntryMarkup(html, segment)
  expectComputedPublicCacheMetadata(cacheMetadata, segment)

  return { cacheMetadata, html }
}

function findSelectedOptimization(segment: CustomerSegment): CustomerSegmentSelection | undefined {
  return segment.selectedOptimizations.find((selection) =>
    Object.hasOwn(selection.variants, segment.baselineEntryId),
  )
}

function expectSelectedEntryMarkup(html: string, segment: CustomerSegment): void {
  const selectedOptimization = findSelectedOptimization(segment)

  expect(html).toContain(`data-ctfl-baseline-id="${segment.baselineEntryId}"`)
  expect(html).toContain(`data-ctfl-entry-id="${segment.variantEntryId}"`)

  if (selectedOptimization === undefined) {
    expect(html).not.toContain('data-ctfl-optimization-id=')
    expect(html).toContain('data-ctfl-variant-index="0"')
    return
  }

  expect(html).toContain(`data-ctfl-optimization-id="${selectedOptimization.experienceId}"`)
  expect(html).toContain(`data-ctfl-variant-index="${selectedOptimization.variantIndex}"`)
}

async function expectPublicPermutationHost(host: Locator, segment: CustomerSegment): Promise<void> {
  const selectedOptimization = findSelectedOptimization(segment)

  await expect(host).toHaveAttribute('data-ctfl-baseline-id', segment.baselineEntryId)
  await expect(host).toHaveAttribute('data-ctfl-entry-id', segment.variantEntryId)

  if (selectedOptimization === undefined) {
    await expect(host).not.toHaveAttribute('data-ctfl-optimization-id', /.+/)
    await expect(host).toHaveAttribute('data-ctfl-variant-index', '0')
    return
  }

  await expect(host).toHaveAttribute('data-ctfl-optimization-id', selectedOptimization.experienceId)
  await expect(host).toHaveAttribute(
    'data-ctfl-variant-index',
    `${selectedOptimization.variantIndex}`,
  )
}

function expectComputedPublicCacheMetadata(
  cacheMetadata: PublicCacheMetadata,
  segment: CustomerSegment = newVisitorSegment,
  expectedTags?: readonly string[],
): void {
  const selectedOptimization = findSelectedOptimization(segment)

  expect(cacheMetadata.scope).toBe('public-permutation')
  if (expectedTags !== undefined) expect(cacheMetadata.tags).toEqual(expectedTags)
  expect(cacheMetadata.key).toContain(`permutation=${segment.slug}`)
  expect(cacheMetadata.key).toContain(`version=${segment.cacheVersion}`)
  expect(cacheMetadata.key).toContain('ctfl-opt-cache:v1')
  expect(cacheMetadata.key).toContain('scope=public-permutation')
  expect(cacheMetadata.key).toContain(`locale=${segment.locale}`)
  expect(cacheMetadata.key).toContain(`entries=${segment.baselineEntryId}`)

  if (selectedOptimization === undefined) {
    expect(cacheMetadata.key).toContain('selection=ctfl-opt-selection:v1:empty')
    expect(cacheMetadata.key).not.toContain('experience=')
    expect(cacheMetadata.key).not.toContain('variants=')
    return
  }

  expect(cacheMetadata.key).toContain(`experience=${selectedOptimization.experienceId}`)
  expect(cacheMetadata.key).toContain(`variants=${segment.baselineEntryId}=`)
  expect(cacheMetadata.key).toContain(segment.variantEntryId)
}

function readHtmlTestIdText(html: string, testId: string): string {
  const match = new RegExp(`data-testid="${testId}"[^>]*>([^<]+)<`).exec(html)
  expect(match?.[1]).toBeTruthy()
  return (match?.[1] ?? '').replaceAll('&amp;', '&')
}

function expectEdgeRuntime(
  response: { headers: () => Record<string, string> },
  payload: unknown,
): void {
  expect(response.headers()['x-edge-runtime-witness']).toBe('edge-runtime')
  expect(payload).toMatchObject({
    runtime: {
      isEdgeRuntime: true,
      witness: 'edge-runtime',
    },
  } satisfies EdgeRuntimePayload)
}

test.describe('Next.js handoff routes', () => {
  runIf('SSR')
  runIfImplementation('nextjs-sdk_app-router')

  test('renders personalized initial SSR and preserves it through hydration', async ({
    page,
    request,
  }) => {
    const rawResponse = await request.get(PAGES.pageTwo.path)
    const rawHtml = await rawResponse.text()

    expect(rawResponse.ok()).toBe(true)
    expect(rawHtml).toContain('data-testid="page-two-view"')
    expect(rawHtml).toContain(newVisitorSegment.resolvedEntryText)
    expectSelectedEntryMarkup(rawHtml, newVisitorSegment)

    await page.goto(PAGES.pageTwo.path)
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByTestId('page-two-view')).toBeVisible()
    await expectPageTwoSelectedVariant(page)
  })

  test('renders the page-only request entry after preserved-layout navigation', async ({
    page,
  }) => {
    await page.goto(PAGES.home.path)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()

    await page.getByTestId('link-page-two').click()
    await expect(page).toHaveURL(/\/page-two$/)
    await expect(page.getByTestId('page-two-view')).toBeVisible()
    await expectPageTwoSelectedVariant(page)
  })

  test('uses forwarded request context without duplicating the initial browser page event', async ({
    page,
  }) => {
    await page.goto(PAGES.home.path)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()

    await expect(page.locator('[data-testid^="event-page-"]')).toHaveCount(0)
  })

  for (const segment of publicPermutationSegments) {
    test(`renders a customer-owned ${segment.slug} public permutation handoff with a cache key`, async ({
      page,
      request,
    }) => {
      const { cacheMetadata } = await expectRawSelectedHandoffHtml({
        cacheKeyTestId: 'selection-cache-key',
        expectedCacheControl: 's-maxage=60',
        path: `/selection-handoff/${segment.slug}`,
        request,
        routeTestId: 'selection-handoff-route',
        segment,
      })

      const response = await page.goto(`/selection-handoff/${segment.slug}`)
      await page.waitForLoadState('domcontentloaded')

      expect(response?.headers()['cache-control']).toContain('s-maxage=60')
      await expect(page.getByTestId('selection-handoff-route')).toBeVisible()
      await expect(page.getByTestId('selection-cache-key')).toHaveText(cacheMetadata.key)

      const host = page.locator(`[data-ctfl-baseline-id="${segment.baselineEntryId}"]`).first()
      await expectPublicPermutationHost(host, segment)
    })
  }

  test('hydrates analytics-only server markup without browser content resolution', async ({
    page,
    request,
  }) => {
    const { cacheMetadata } = await expectRawSelectedHandoffHtml({
      cacheKeyTestId: 'analytics-cache-key',
      expectedCacheControl: 's-maxage=60',
      path: `/analytics-only/${newVisitorSegment.slug}`,
      request,
      routeTestId: 'analytics-only-route',
    })

    const clientContentfulRequests: string[] = []
    const clientExperienceRequests: string[] = []
    await page.route('**/contentful/**', async (route) => {
      clientContentfulRequests.push(route.request().url())
      await route.continue()
    })
    await page.route('**/experience/**', async (route) => {
      clientExperienceRequests.push(route.request().url())
      await route.continue()
    })

    const response = await page.goto(`/analytics-only/${newVisitorSegment.slug}`)
    await page.waitForLoadState('networkidle')

    expect(response?.headers()['cache-control']).toContain('s-maxage=60')
    await expect(page.getByTestId('analytics-only-route')).toBeVisible()
    await expect(page.getByTestId('analytics-cache-key')).toHaveText(cacheMetadata.key)
    await expect(page.getByTestId('analytics-only-sidebar')).toBeVisible()
    await expect(page.getByTestId('analytics-events-container')).toHaveCount(0)

    const host = page.getByTestId(`analytics-entry-${newVisitorSegment.baselineEntryId}`)
    await expectPublicPermutationHost(host, newVisitorSegment)
    expect(clientContentfulRequests).toEqual([])
    expect(clientExperienceRequests.length).toBeGreaterThan(0)
    expect(clientExperienceRequests.every((url) => url.includes('/profiles'))).toBe(true)
  })

  test('renders the client-only hidden-until-ready route', async ({ page, request }) => {
    const rawResponse = await request.get('/hidden-until-ready')
    const rawHtml = await rawResponse.text()

    expect(rawResponse.ok()).toBe(true)
    await expectRawHiddenUntilReadyHtml(page, rawHtml)

    await page.goto('/hidden-until-ready')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByTestId('hidden-until-ready-route')).toBeVisible()
    await expect(page.getByTestId('content-hidden-until-ready')).toBeVisible()
  })

  test('renders a static shell with a personalized private request slot', async ({ page }) => {
    await page.goto('/static-shell-private-slot')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByTestId('static-shell-private-slot-shell')).toBeVisible()
    await expect(page.getByTestId('private-request-slot')).toBeVisible()
    await expect(page.getByTestId('analytics-events-container')).toBeVisible()
    await expect(page.getByTestId('consent-button')).toBeVisible()

    const host = page
      .locator(`[data-ctfl-baseline-id="${newVisitorSegment.baselineEntryId}"]`)
      .first()
    await expect(host).toHaveAttribute('data-ctfl-entry-id', newVisitorSegment.variantEntryId)
    await expect(host).toHaveAttribute('data-ctfl-optimization-id', newVisitorSegment.experienceId)
    await expect(host).toHaveAttribute('data-ctfl-variant-index', '1')
    await expect(page.getByTestId(`entry-text-${newVisitorSegment.baselineEntryId}`)).toContainText(
      newVisitorSegment.resolvedEntryText,
    )
  })
})

test.describe('Next.js Edge runtime handoff routes', () => {
  runIf('EDGE')
  runIfImplementation('nextjs-sdk_app-router_edge-runtime')

  test('creates a request handoff with private request cache scope', async ({ request }) => {
    const response = await request.get('/edge-request')
    const payload: unknown = await response.json()

    expect(response.ok()).toBe(true)
    expectEdgeRuntime(response, payload)
    expect(response.headers()['cache-control']).toBe('private, no-store')
    expect(response.headers()['x-optimization-cache-scope']).toBe('private-request')
    expect(payload).toMatchObject({
      accepted: true,
      cache: { scope: 'private-request' },
      hydration: 'preserve-server',
      initialPageEvent: 'skip',
    })
  })

  for (const segment of publicPermutationSegments) {
    test(`creates a ${segment.slug} public permutation handoff with customer-owned cache metadata`, async ({
      request,
    }) => {
      const response = await request.get(`/edge-selection/${segment.slug}`)
      const payload: unknown = await response.json()
      const cacheMetadata = readPublicCacheMetadata(payload)
      const cacheTags = [`ctfl-opt-segment:${segment.slug}:v${segment.cacheVersion}`]

      expect(response.ok()).toBe(true)
      expectEdgeRuntime(response, payload)
      expect(response.headers()['x-optimization-cache-scope']).toBe('public-permutation')
      expect(response.headers()['x-optimization-cache-key']).toBe(cacheMetadata.key)
      expectComputedPublicCacheMetadata(cacheMetadata, segment, cacheTags)

      if (segment.selectedOptimizations.length === 0) {
        expect(payload).toMatchObject({
          cache: {
            key: cacheMetadata.key,
            scope: 'public-permutation',
            tags: cacheTags,
          },
          selectedOptimizations: [],
        })
        return
      }

      const selectedOptimization = findSelectedOptimization(segment)
      if (selectedOptimization === undefined) {
        throw new Error(`Expected segment "${segment.slug}" to include a selected optimization.`)
      }

      expect(payload).toMatchObject({
        cache: {
          key: cacheMetadata.key,
          scope: 'public-permutation',
          tags: cacheTags,
        },
        selectedOptimizations: [
          expect.objectContaining({
            experienceId: selectedOptimization.experienceId,
            variantIndex: selectedOptimization.variantIndex,
          }),
        ],
      })
    })
  }
})

test.describe('Next.js Pages Router public permutation handoff routes', () => {
  runIf('SSR')
  runIfImplementation('nextjs-sdk_pages-router')

  for (const segment of publicPermutationSegments) {
    test(`renders an ISR ${segment.slug} public permutation handoff and preserves it after hydration`, async ({
      page,
      request,
    }) => {
      const path = `/selection-handoff/${segment.slug}`
      const response = await request.get(path)
      const html = await response.text()

      expect(response.ok()).toBe(true)
      expect(response.headers()['cache-control']).toContain('s-maxage=60')
      expect(html).toContain('data-testid="pages-selection-handoff-route"')
      expect(html).toContain('data-testid="pages-selection-cache-key"')
      expect(html).toContain(`permutation=${segment.slug}`)
      expect(html).toContain(`version=${segment.cacheVersion}`)
      expect(html).toContain(segment.resolvedEntryText)
      expectSelectedEntryMarkup(html, segment)

      const rawCacheKey = readHtmlTestIdText(html, 'pages-selection-cache-key')

      const hydrationResponse = await page.goto(path)
      await page.waitForLoadState('domcontentloaded')

      expect(hydrationResponse?.headers()['cache-control']).toContain('s-maxage=60')
      await expect(page.getByTestId('pages-selection-handoff-route')).toBeVisible()
      await expect(page.getByTestId('pages-selection-cache-key')).toHaveText(rawCacheKey)
      await expect(
        page.getByTestId(`entry-text-pages-selection-${segment.baselineEntryId}`),
      ).toContainText(segment.resolvedEntryText)

      const host = page.getByTestId(`pages-selection-entry-${segment.baselineEntryId}`)
      await expectPublicPermutationHost(host, segment)
    })
  }
})
