import { expect, test } from '@playwright/test'
import { CONSENT_COOKIE, runIf, seedAnonymousProfile, seedIdentifiedProfile } from './utils'

test.describe('Hydration', () => {
  runIf('HYDRATION')

  test('does not issue a client Experience request after consented SSR hydration', async ({
    baseURL,
    context,
    page,
  }) => {
    await context.addCookies([{ name: CONSENT_COOKIE, value: 'granted', url: baseURL }])
    const clientExperienceRequests: string[] = []
    await page.route('**/experience/**', async (route) => {
      clientExperienceRequests.push(route.request().url())
      await route.continue()
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()

    expect(clientExperienceRequests).toEqual([])
  })
})

test.describe('SSR first-paint state', () => {
  runIf('SSR')
  test.use({ javaScriptEnabled: false })

  test.describe('unidentified user', () => {
    test('consent-status is No without consent cookie', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')

      await expect(page.getByTestId('consent-status')).toHaveText('No')
      await expect(page.getByTestId('identified-status')).toHaveText('No')
    })

    test('consent-status is Yes with consent cookie', async ({ baseURL, context, page }) => {
      await seedAnonymousProfile(context, baseURL)

      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')

      await expect(page.getByTestId('consent-status')).toHaveText('Yes')
      await expect(page.getByTestId('identified-status')).toHaveText('No')
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
})
