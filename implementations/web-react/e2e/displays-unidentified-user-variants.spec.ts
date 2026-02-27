import { expect, test } from '@playwright/test'

test.describe('unidentified user', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
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
        .or(continentEntry.getByText('This is a baseline content entry for visitors from any continent.')),
    ).toBeVisible()

    const deviceEntry = page.getByTestId('entry-text-xFwgG3oNaOcjzWiGe4vXo')
    await expect(
      deviceEntry
        .getByText('This is a variant content entry for visitors using a desktop browser.')
        .or(deviceEntry.getByText('This is a baseline content entry for all visitors using any device.')),
    ).toBeVisible()
  })

  test('displays unidentified user variants', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Auto Observed Entries' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Manually Observed Entries' })).toBeVisible()

    await expect(page.getByText('This is a level 0 nested baseline entry.')).toBeVisible()
    await expect(page.getByText('This is a level 1 nested baseline entry.')).toBeVisible()
    await expect(page.getByText('This is a level 2 nested baseline entry.')).toBeVisible()

    const visitorVariant = page.getByTestId('entry-text-2Z2WLOx07InSewC3LUB3eX')
    await expect(
      visitorVariant
        .getByText('This is a variant content entry for new visitors.')
        .or(visitorVariant.getByText('This is a variant content entry for return visitors.')),
    ).toBeVisible()
    await expect(
      page.getByText('This is a variant content entry for an A/B/C experiment: B'),
    ).toBeVisible()
    await expect(
      page.getByText(
        'This is a baseline content entry for all visitors with or without a custom event.',
      ),
    ).toBeVisible()
    await expect(
      page.getByText('This is a baseline content entry for all identified or unidentified users.'),
    ).toBeVisible()
  })
})
