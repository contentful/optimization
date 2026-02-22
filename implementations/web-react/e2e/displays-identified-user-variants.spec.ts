import { expect, test } from '@playwright/test'

test.describe('identified user', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Identify' }).click()
    await expect(page.getByRole('button', { name: 'Reset Profile' })).toBeVisible()
  })

  test('renders identified variants', async ({ page }) => {
    await expect(page.getByText('This is a variant content entry for identified users.')).toBeVisible()
    await expect(page.getByText('This is a level 0 nested variant entry.')).toBeVisible()
  })
})
