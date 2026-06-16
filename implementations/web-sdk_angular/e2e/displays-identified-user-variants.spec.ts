import { expect, test } from '@playwright/test'

test.describe('identified user', () => {
  test.beforeEach(async ({ page }) => {
    await test.step('load home page', async () => {
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')
      await expect(
        page.getByRole('heading', { name: 'Utilities' }),
        'Utilities heading should be visible after load',
      ).toBeVisible()
    })

    await test.step('grant consent', async () => {
      await page.getByTestId('consent-button').click()
      await expect(
        page.getByTestId('consent-status'),
        'consent-status should show true after granting',
      ).toHaveText('Consent: true')
    })

    await test.step('identify user', async () => {
      await page.getByTestId('live-updates-identify-button').click()
      await expect(
        page.getByTestId('live-updates-reset-button'),
        'reset button should appear after identify',
      ).toBeVisible()
    })

    await test.step('reload and verify identified state persists', async () => {
      await page.reload()
      await page.waitForLoadState('domcontentloaded')
      await expect(
        page.getByRole('heading', { name: 'Utilities' }),
        'Utilities heading should be visible after reload',
      ).toBeVisible()
      await expect(
        page.getByTestId('live-updates-reset-button'),
        'reset button should still be visible after reload — identified state was not persisted',
      ).toBeVisible()
    })
  })

  test('displays common variants', async ({ page }) => {
    await expect(
      page.getByText(
        'This is a merge tag content entry that displays the visitor\'s continent "EU" embedded within the text.',
      ),
    ).toBeVisible()

    const continentEntry = page.getByTestId('entry-text-4ib0hsHWoSOnCVdDkizE8d')
    await expect(
      continentEntry
        .getByText('This is a variant content entry for visitors from Europe.')
        .or(
          continentEntry.getByText(
            'This is a baseline content entry for visitors from any continent.',
          ),
        ),
    ).toBeVisible()

    const deviceEntry = page.getByTestId('entry-text-xFwgG3oNaOcjzWiGe4vXo')
    await expect(
      deviceEntry
        .getByText('This is a variant content entry for visitors using a desktop browser.')
        .or(
          deviceEntry.getByText(
            'This is a baseline content entry for all visitors using any device.',
          ),
        ),
    ).toBeVisible()
  })
})
