import { expect, test } from '@playwright/test'

test.describe('identified user', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Identify' }).click()
    await expect(page.getByRole('button', { name: 'Reset Profile' })).toBeVisible()

    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: 'Reset Profile' })).toBeVisible()
  })

  test('renders identified variants', async ({ page }) => {
    await expect(
      page.getByText('This is a variant content entry for identified users.'),
    ).toBeVisible()
    await expect(page.getByText('This is a level 0 nested variant entry.')).toBeVisible()
  })

  test('reset persists unidentified state across reload', async ({ page }) => {
    await page.getByRole('button', { name: 'Reset Profile' }).click()
    await expect(page.getByRole('button', { name: 'Identify' })).toBeVisible()

    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: 'Identify' })).toBeVisible()
    await expect(
      page.getByText('This is a baseline content entry for all identified or unidentified users.'),
    ).toBeVisible()
    await expect(page.getByText('This is a level 0 nested baseline entry.')).toBeVisible()
    await expect(
      page.getByText('This is a variant content entry for identified users.'),
    ).toHaveCount(0)
  })
})
