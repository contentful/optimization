import { expect, test } from '@playwright/test'

test.describe('Next.js SSR behavior', () => {
  test('renders server tracking attributes on first paint', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const entry = page.locator('[data-ctfl-entry-id]').first()
    await expect(entry).toBeVisible()
    await expect(entry).toHaveAttribute('data-ctfl-baseline-id', /.+/)
    await expect(entry).toHaveAttribute('data-ctfl-variant-index', /\d+/)
  })

  test('does not issue a client Experience request after consented SSR hydration', async ({
    context,
    page,
  }) => {
    await context.addCookies([
      {
        name: 'app-personalization-consent',
        value: 'granted',
        url: 'http://localhost:3001',
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
