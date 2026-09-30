import { expect, test, type Page } from '@playwright/test'
import {
  CONSENT_COOKIE,
  PROFILE_COOKIE,
  runIf,
  runIfImplementation,
  seedAnonymousProfile,
  seedIdentifiedProfile,
  skipIf,
} from './utils'

test.describe('Hydration', () => {
  runIf('HYDRATION')
  runIfImplementation('nextjs-sdk_pages-router', 'web-sdk_angular')

  test('preserves the server preflight and commits its replay once in the browser', async ({
    baseURL,
    context,
    page,
  }) => {
    await context.addCookies([{ name: CONSENT_COOKIE, value: 'granted', url: baseURL }])
    const clientExperienceRequests: Array<{ readonly method: string; readonly url: string }> = []
    await page.route('**/experience/**', async (route) => {
      clientExperienceRequests.push({
        method: route.request().method(),
        url: route.request().url(),
      })
      await route.continue()
    })

    const response = await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()

    expect(response?.headers()['set-cookie']).toBeUndefined()
    expect(clientExperienceRequests).toEqual([
      expect.objectContaining({ method: 'POST', url: expect.stringContaining('/experience/') }),
    ])
    expect((await context.cookies()).some((cookie) => cookie.name === PROFILE_COOKIE)).toBe(true)
  })
})

test.describe('SSR first-paint state', () => {
  runIf('SSR')
  skipIf('SKIP_NO_JS')
  test.use({ javaScriptEnabled: false })

  test.describe('unidentified user', () => {
    test('consent-status is No without consent cookie', async ({ page }) => {
      const response = await page.goto('/')
      await page.waitForLoadState('domcontentloaded')

      await expect(page.getByTestId('consent-status')).toHaveText('No')
      await expect(page.getByTestId('identified-status')).toHaveText('No')
      expect(response?.headers()['set-cookie']).toBeUndefined()
    })

    test('consent-status is Yes with consent cookie', async ({ baseURL, context, page }) => {
      await context.addCookies([{ name: CONSENT_COOKIE, value: 'granted', url: baseURL }])

      const response = await page.goto('/')
      await page.waitForLoadState('domcontentloaded')

      await expect(page.getByTestId('consent-status')).toHaveText('Yes')
      await expect(page.getByTestId('identified-status')).toHaveText('No')
      expect(response?.headers()['set-cookie']).toBeUndefined()
      expect((await context.cookies()).some((cookie) => cookie.name === PROFILE_COOKIE)).toBe(false)
    })
  })

  test.describe('identified user', () => {
    test('consent-status and identified-status reflect server profile', async ({
      baseURL,
      context,
      page,
      request,
    }) => {
      await seedIdentifiedProfile(context, baseURL, request)

      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')

      await expect(page.getByTestId('consent-status')).toHaveText('Yes')
      await expect(page.getByTestId('identified-status')).toHaveText('Yes')
    })
  })

  test.describe('server-resolved variants', () => {
    const BASELINE_ID = '2Z2WLOx07InSewC3LUB3eX'
    const EXPERIENCE_ID = '2cSY1TX0nDfYe4fuIrGQ1K'
    const VARIANT_ENTRY_ID = '1UFf7qr4mHET3HYuYmcpEj'

    async function expectServerResolvedVariant(page: Page): Promise<void> {
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')

      const host = page.locator(`[data-ctfl-baseline-id="${BASELINE_ID}"]`).first()
      await expect(host).toHaveAttribute('data-ctfl-entry-id', VARIANT_ENTRY_ID)
      await expect(host).toHaveAttribute('data-ctfl-optimization-id', EXPERIENCE_ID)
      await expect(host).toHaveAttribute('data-ctfl-variant-index', '1')
    }

    test('renders the variant for a new visitor before consent', async ({ page }) => {
      await expectServerResolvedVariant(page)
    })

    test('renders the variant for a consented visitor', async ({ baseURL, context, page }) => {
      await seedAnonymousProfile(context, baseURL)

      await expectServerResolvedVariant(page)
    })
  })
})
