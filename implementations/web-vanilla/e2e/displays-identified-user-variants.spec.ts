import { expect, test } from '@playwright/test'

test.describe('displays identified user variants', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const identify = page.getByRole('button', { name: 'Identify' })
    await identify.click()

    await page.reload()
    await page.waitForLoadState('domcontentloaded')
  })

  test('displays return visitor variant', async ({ page }) => {
    await expect(
      page.getByText('This is a variant content entry for return visitors.'),
    ).toBeVisible()
  })

  test('displays A/B/C experiment baseline', async ({ page }) => {
    await expect(
      page.getByText('This is a baseline content entry for an A/B/C experiment: A'),
    ).toBeVisible()
  })

  test('displays custom event entry exists variant', async ({ page }) => {
    await expect(
      page.getByText('This is a variant content entry for visitors with a custom event.'),
    ).toBeVisible()
  })

  test('displays identified user variant', async ({ page }) => {
    await expect(
      page.getByText('This is a variant content entry for identified users.'),
    ).toBeVisible()
  })
})
