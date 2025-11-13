import { expect, test } from '@playwright/test'

test.describe('displays identified user variants', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
  })

  test('displays new visitor variant', async ({ page }) => {
    await expect(page.getByText('This is a variant content entry for new visitors.')).toBeVisible()
  })

  test('displays A/B/C experiment baseline', async ({ page }) => {
    await expect(
      page.getByText('This is a baseline content entry for an A/B/C experiment: A'),
    ).toBeVisible()
  })

  test('displays custom event entry baseline', async ({ page }) => {
    await expect(
      page.getByText(
        'This is a baseline content entry for all visitors with or without a custom event.',
      ),
    ).toBeVisible()
  })

  test('displays identified/unidentified baseline', async ({ page }) => {
    await expect(
      page.getByText('This is a baseline content entry for all identified or unidentified users.'),
    ).toBeVisible()
  })
})
