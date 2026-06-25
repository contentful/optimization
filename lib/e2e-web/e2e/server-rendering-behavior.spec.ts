import { expect, test } from '@playwright/test'
import { runIf } from './utils'

test.describe('Server-Rendering Behavior', () => {
  runIf('HYDRATION')

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
