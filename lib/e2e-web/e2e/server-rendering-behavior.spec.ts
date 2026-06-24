import { expect, test } from '@playwright/test'

const RENDERING_MODE = (process.env.RENDERING_MODE ?? 'csr').toLowerCase()

test.describe('server-rendering behavior', () => {
  test.skip(
    RENDERING_MODE !== 'ssr' && RENDERING_MODE !== 'hybrid',
    'Server-rendering behavior tests only run in ssr or hybrid mode.',
  )

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
})
