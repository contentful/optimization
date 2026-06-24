import { expect, test } from '@playwright/test'

const RENDERING_MODE = (process.env.RENDERING_MODE ?? 'csr').toLowerCase()
const isSSR = RENDERING_MODE === 'ssr'
const isHybrid = RENDERING_MODE === 'hybrid'

test.describe('server-rendering behavior', () => {
  test.skip(!isSSR && !isHybrid, 'Server-rendering behavior tests only run in ssr or hybrid mode.')

  test('does not issue a client Experience request after consented SSR hydration', async ({
    baseURL,
    context,
    page,
  }) => {
    await context.addCookies([
      { name: 'app-personalization-consent', value: 'granted', url: baseURL },
    ])
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

  test('renders server-side tracking attributes on first paint', async ({ page }) => {
    test.skip(!isSSR, 'Tracking attributes are only present in SSR mode.')

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const entry = page.locator('[data-ctfl-entry-id]').first()
    await expect(entry).toBeVisible()
    await expect(entry).toHaveAttribute('data-ctfl-baseline-id', /.+/)
    await expect(entry).toHaveAttribute('data-ctfl-variant-index', /\d+/)
  })
})
