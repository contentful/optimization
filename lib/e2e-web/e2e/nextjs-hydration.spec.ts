import { expect, test } from '@playwright/test'

const RENDERING_MODE = (process.env.RENDERING_MODE ?? 'csr').toLowerCase()

test.describe('Next.js hydration behavior', () => {
  test.skip(RENDERING_MODE !== 'hybrid', 'Next.js hydration tests only run in hybrid mode.')

  test('does not issue a client Experience request after consented SSR hydration', async ({
    baseURL,
    context,
    page,
  }) => {
    await context.addCookies([
      {
        name: 'app-personalization-consent',
        value: 'granted',
        url: baseURL ?? 'http://localhost:3002',
      },
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
})
