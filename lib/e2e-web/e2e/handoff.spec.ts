import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { CUSTOMER_SEGMENTS, PAGES } from '../src/fixtures'
import { runIf, runIfImplementation } from './utils'

const newVisitorSegment = CUSTOMER_SEGMENTS['new-visitor']
const baselineSegment = CUSTOMER_SEGMENTS.baseline
const publicPermutationSegments = [newVisitorSegment, baselineSegment] as const

type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[keyof typeof CUSTOMER_SEGMENTS]
type CustomerSegmentSelection = CustomerSegment['selectedOptimizations'][number]

async function expectPageTwoSelectedVariant(page: Page): Promise<void> {
  const host = page.locator(`[data-ctfl-baseline-id="${PAGES.pageTwo.auto}"]`).first()
  await expect(host).toHaveAttribute('data-ctfl-entry-id', newVisitorSegment.variantEntryId)
  await expect(host).toHaveAttribute('data-ctfl-optimization-id', newVisitorSegment.experienceId)
  await expect(host).toHaveAttribute('data-ctfl-variant-index', '1')
}

async function expectRawSelectedHandoffHtml({
  path,
  request,
  routeTestId,
  segment = newVisitorSegment,
}: {
  readonly path: string
  readonly request: APIRequestContext
  readonly routeTestId: string
  readonly segment?: CustomerSegment
}): Promise<void> {
  const response = await request.get(path)
  const html = await response.text()

  expect(response.ok()).toBe(true)
  expect(html).toContain(`data-testid="${routeTestId}"`)
  expect(html).toContain(segment.resolvedEntryText)
  expectSelectedEntryMarkup(html, segment)
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

  test('commits one initial browser page while preserving the server render', async ({ page }) => {
    const delivery = page.waitForResponse(
      (response) =>
        response.url().includes('/experience/') &&
        response.request().method() === 'POST' &&
        response.ok(),
    )
    await page.goto(PAGES.home.path)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
    await expect(page.locator('[data-testid^="event-page-"]')).toHaveCount(1)
    await delivery
  })

  for (const segment of publicPermutationSegments) {
    test(`renders a customer-owned ${segment.slug} public permutation after hydration`, async ({
      page,
      request,
    }) => {
      await expectRawSelectedHandoffHtml({
        path: `/selection-handoff/${segment.slug}`,
        request,
        routeTestId: 'selection-handoff-route',
        segment,
      })

      await page.goto(`/selection-handoff/${segment.slug}`)
      await page.waitForLoadState('domcontentloaded')

      await expect(page.getByTestId('selection-handoff-route')).toBeVisible()
      await expect(page.getByTestId(`entry-text-${segment.baselineEntryId}`)).toContainText(
        segment.resolvedEntryText,
      )

      const host = page.locator(`[data-ctfl-baseline-id="${segment.baselineEntryId}"]`).first()
      await expectPublicPermutationHost(host, segment)
    })
  }

  test('hydrates analytics-only server markup without browser content resolution', async ({
    page,
    request,
  }) => {
    await expectRawSelectedHandoffHtml({
      path: `/analytics-only/${newVisitorSegment.slug}`,
      request,
      routeTestId: 'analytics-only-route',
    })

    const clientContentfulRequests: string[] = []
    await page.route('**/contentful/**', async (route) => {
      clientContentfulRequests.push(route.request().url())
      await route.continue()
    })
    const delivery = page.waitForResponse(
      (response) =>
        response.url().includes('/experience/') &&
        response.request().method() === 'POST' &&
        response.ok(),
    )

    await page.goto(`/analytics-only/${newVisitorSegment.slug}`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByTestId('analytics-only-route')).toBeVisible()
    await expect(page.getByTestId('analytics-only-sidebar')).toBeVisible()
    await expect(page.getByTestId('analytics-events-container')).toHaveCount(0)

    const host = page.getByTestId(`analytics-entry-${newVisitorSegment.baselineEntryId}`)
    await expectPublicPermutationHost(host, newVisitorSegment)
    await expect(
      page.getByTestId(`entry-text-analytics-${newVisitorSegment.baselineEntryId}`),
    ).toContainText(newVisitorSegment.resolvedEntryText)
    expect(clientContentfulRequests).toEqual([])
    await delivery
  })

  test('renders the client-only hidden-until-ready route with a query string', async ({
    page,
    request,
  }) => {
    const path = '/hidden-until-ready?source=e2e'
    const rawResponse = await request.get(path)
    const rawHtml = await rawResponse.text()

    expect(rawResponse.ok()).toBe(true)
    expect(rawHtml).toContain('data-testid="hidden-until-ready-route"')

    await page.goto(path)
    await page.waitForLoadState('domcontentloaded')

    await expect(page).toHaveURL(path)
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
      expect(html).toContain('data-testid="pages-selection-handoff-route"')
      expect(html).toContain(segment.resolvedEntryText)
      expectSelectedEntryMarkup(html, segment)

      await page.goto(path)
      await page.waitForLoadState('domcontentloaded')

      await expect(page.getByTestId('pages-selection-handoff-route')).toBeVisible()
      await expect(
        page.getByTestId(`entry-text-pages-selection-${segment.baselineEntryId}`),
      ).toContainText(segment.resolvedEntryText)

      const host = page.getByTestId(`pages-selection-entry-${segment.baselineEntryId}`)
      await expectPublicPermutationHost(host, segment)
    })
  }
})
