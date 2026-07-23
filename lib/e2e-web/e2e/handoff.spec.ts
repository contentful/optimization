import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { CUSTOMER_SEGMENTS, PAGES } from '../src/fixtures'
import { runIf, runIfImplementation } from './utils'

const newVisitorSegment = CUSTOMER_SEGMENTS['new-visitor']

interface PublicCacheMetadata {
  readonly key: string
  readonly scope: 'public-permutation'
  readonly tags: readonly string[]
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
    Array.isArray(tags) &&
    tags.every((tag) => typeof tag === 'string')
  )
}

function readPublicCacheMetadata(payload: unknown): PublicCacheMetadata {
  if (!isRecord(payload) || !isPublicCacheMetadata(payload.cache)) {
    throw new Error('Edge selection response did not include public cache metadata.')
  }

  return payload.cache
}

async function expectPageTwoSelectedVariant(page: Page): Promise<void> {
  const host = page.locator(`[data-ctfl-baseline-id="${PAGES.pageTwo.auto}"]`).first()
  await expect(host).toHaveAttribute('data-ctfl-entry-id', newVisitorSegment.variantEntryId)
  await expect(host).toHaveAttribute('data-ctfl-optimization-id', newVisitorSegment.experienceId)
  await expect(host).toHaveAttribute('data-ctfl-variant-index', '1')
}

async function expectRawSelectedHandoffHtml({
  cacheKeyTestId,
  cacheMetadata,
  expectedCacheControl,
  path,
  request,
  routeTestId,
}: {
  readonly cacheKeyTestId: string
  readonly cacheMetadata: PublicCacheMetadata
  readonly expectedCacheControl?: string
  readonly path: string
  readonly request: APIRequestContext
  readonly routeTestId: string
}): Promise<string> {
  const response = await request.get(path)
  const html = await response.text()

  expect(response.ok()).toBe(true)
  if (expectedCacheControl !== undefined) {
    expect(response.headers()['cache-control']).toContain(expectedCacheControl)
  }
  expect(html).toContain(`data-testid="${routeTestId}"`)
  expect(html).toContain(`data-testid="${cacheKeyTestId}"`)
  expect(html).toContain(cacheMetadata.key)
  expect(html).toContain(newVisitorSegment.resolvedEntryText)
  expect(html).toContain(`data-ctfl-baseline-id="${newVisitorSegment.baselineEntryId}"`)
  expect(html).toContain(`data-ctfl-entry-id="${newVisitorSegment.variantEntryId}"`)
  expect(html).toContain(`data-ctfl-optimization-id="${newVisitorSegment.experienceId}"`)
  expect(html).toContain('data-ctfl-variant-index="1"')

  return html
}

function expectComputedPublicCacheMetadata(cacheMetadata: PublicCacheMetadata): void {
  expect(cacheMetadata.scope).toBe('public-permutation')
  expect(cacheMetadata.tags).toEqual([cacheMetadata.key])
  expect(cacheMetadata.key).toContain(`segment:${newVisitorSegment.slug}`)
  expect(cacheMetadata.key).toContain(`v${newVisitorSegment.cacheVersion}`)
  expect(cacheMetadata.key).toContain('ctfl-opt-cache:v1')
  expect(cacheMetadata.key).toContain('scope=public-permutation')
  expect(cacheMetadata.key).toContain(`locale=${newVisitorSegment.locale}`)
  expect(cacheMetadata.key).toContain(`entries=${newVisitorSegment.baselineEntryId}`)
  expect(cacheMetadata.key).toContain(`experience=${newVisitorSegment.experienceId}`)
  expect(cacheMetadata.key).toContain(`variants=${newVisitorSegment.baselineEntryId}=`)
  expect(cacheMetadata.key).toContain(newVisitorSegment.variantEntryId)
}

async function getExpectedPublicCacheMetadata(
  request: APIRequestContext,
): Promise<PublicCacheMetadata> {
  const response = await request.get(`/edge-selection/${newVisitorSegment.slug}`)
  const payload: unknown = await response.json()
  const cacheMetadata = readPublicCacheMetadata(payload)

  expect(response.ok()).toBe(true)
  expect(response.headers()['x-optimization-cache-scope']).toBe('public-permutation')
  expect(response.headers()['x-optimization-cache-key']).toBe(cacheMetadata.key)
  expectComputedPublicCacheMetadata(cacheMetadata)

  return cacheMetadata
}

test.describe('Next.js handoff routes', () => {
  runIf('SSR')
  runIfImplementation('nextjs-sdk_app-router')

  test('renders request handoff variants on a page-two hard load', async ({ page }) => {
    await page.goto(PAGES.pageTwo.path)
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByTestId('page-two-view')).toBeVisible()
    await expectPageTwoSelectedVariant(page)
  })

  test('renders request handoff variants after client navigation to page two', async ({ page }) => {
    await page.goto(PAGES.home.path)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()

    await page.getByTestId('link-page-two').click()
    await expect(page).toHaveURL(/\/page-two$/)
    await expect(page.getByTestId('page-two-view')).toBeVisible()
    await expectPageTwoSelectedVariant(page)
  })

  test('renders a customer-owned public selection handoff with a cache key', async ({
    page,
    request,
  }) => {
    const cacheMetadata = await getExpectedPublicCacheMetadata(request)

    await expectRawSelectedHandoffHtml({
      cacheKeyTestId: 'selection-cache-key',
      cacheMetadata,
      expectedCacheControl: 's-maxage=60',
      path: `/selection-handoff/${newVisitorSegment.slug}`,
      request,
      routeTestId: 'selection-handoff-route',
    })

    const response = await page.goto(`/selection-handoff/${newVisitorSegment.slug}`)
    await page.waitForLoadState('domcontentloaded')

    expect(response?.headers()['cache-control']).toContain('s-maxage=60')
    await expect(page.getByTestId('selection-handoff-route')).toBeVisible()
    await expect(page.getByTestId('selection-cache-key')).toHaveText(cacheMetadata.key)

    const host = page.locator(`[data-ctfl-baseline-id="${newVisitorSegment.baselineEntryId}"]`)
    await expect(host).toHaveAttribute('data-ctfl-entry-id', newVisitorSegment.variantEntryId)
    await expect(host).toHaveAttribute('data-ctfl-optimization-id', newVisitorSegment.experienceId)
    await expect(host).toHaveAttribute('data-ctfl-variant-index', '1')
  })

  test('hydrates analytics-only server markup without browser content resolution', async ({
    page,
    request,
  }) => {
    const cacheMetadata = await getExpectedPublicCacheMetadata(request)

    await expectRawSelectedHandoffHtml({
      cacheKeyTestId: 'analytics-cache-key',
      cacheMetadata,
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

    const host = page.getByTestId(`analytics-entry-${newVisitorSegment.baselineEntryId}`)
    await expect(host).toHaveAttribute('data-ctfl-entry-id', newVisitorSegment.variantEntryId)
    await expect(host).toHaveAttribute('data-ctfl-optimization-id', newVisitorSegment.experienceId)
    expect(clientContentfulRequests).toEqual([])
    expect(clientExperienceRequests.some((url) => url.includes('/profiles'))).toBe(true)
  })

  test('renders the client-only hidden-until-ready route', async ({ page }) => {
    await page.goto('/hidden-until-ready')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByTestId('hidden-until-ready-route')).toBeVisible()
    await expect(page.getByTestId('content-hidden-until-ready')).toBeVisible()
  })

  test('creates an Edge request handoff with private request cache scope', async ({ request }) => {
    const response = await request.get('/edge-request')
    const payload: unknown = await response.json()

    expect(response.ok()).toBe(true)
    expect(response.headers()['x-optimization-cache-scope']).toBe('private-request')
    expect(payload).toMatchObject({
      cache: { scope: 'private-request' },
      hydration: 'preserve-server',
      initialPageEvent: expect.stringMatching(/^(emit|skip)$/),
    })
  })

  test('creates an Edge public selection handoff with customer-owned cache metadata', async ({
    request,
  }) => {
    const response = await request.get(`/edge-selection/${newVisitorSegment.slug}`)
    const payload: unknown = await response.json()
    const cacheMetadata = readPublicCacheMetadata(payload)

    expect(response.ok()).toBe(true)
    expect(response.headers()['x-optimization-cache-scope']).toBe('public-permutation')
    expect(response.headers()['x-optimization-cache-key']).toBe(cacheMetadata.key)
    expectComputedPublicCacheMetadata(cacheMetadata)
    expect(payload).toMatchObject({
      cache: {
        key: cacheMetadata.key,
        scope: 'public-permutation',
        tags: [cacheMetadata.key],
      },
      selectedOptimizations: [
        expect.objectContaining({
          experienceId: newVisitorSegment.experienceId,
          variantIndex: 1,
        }),
      ],
    })
  })

  test('renders Edge HTML selected markup and hydrates analytics without browser content resolution', async ({
    page,
    request,
  }) => {
    const cacheMetadata = await getExpectedPublicCacheMetadata(request)

    await expectRawSelectedHandoffHtml({
      cacheKeyTestId: 'edge-html-cache-key',
      cacheMetadata,
      path: `/edge-html/${newVisitorSegment.slug}`,
      request,
      routeTestId: 'edge-html-route',
    })

    const clientContentfulRequests: string[] = []
    const clientExperienceRequests: string[] = []
    const clientInsightsRequests: string[] = []
    await page.route('**/contentful/**', async (route) => {
      clientContentfulRequests.push(route.request().url())
      await route.continue()
    })
    await page.route('**/experience/**', async (route) => {
      clientExperienceRequests.push(route.request().url())
      await route.continue()
    })
    await page.route('**/insights/**', async (route) => {
      clientInsightsRequests.push(route.request().url())
      await route.continue()
    })

    const response = await page.goto(`/edge-html/${newVisitorSegment.slug}`)
    await page.waitForLoadState('networkidle')

    expect(response?.ok()).toBe(true)
    await expect(page.getByTestId('edge-html-route')).toBeVisible()
    await expect(page.getByTestId('edge-html-cache-key')).toHaveText(cacheMetadata.key)
    await expect(
      page.getByTestId(`edge-html-entry-text-${newVisitorSegment.baselineEntryId}`),
    ).toHaveText(newVisitorSegment.resolvedEntryText)

    const host = page.getByTestId(`edge-html-entry-${newVisitorSegment.baselineEntryId}`)
    await expect(host).toHaveAttribute('data-ctfl-entry-id', newVisitorSegment.variantEntryId)
    await expect(host).toHaveAttribute('data-ctfl-optimization-id', newVisitorSegment.experienceId)
    await expect(host).toHaveAttribute('data-ctfl-variant-index', '1')
    await expect
      .poll(() => clientExperienceRequests.length + clientInsightsRequests.length)
      .toBeGreaterThan(0)
    expect(clientContentfulRequests).toEqual([])
  })
})
