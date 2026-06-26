import { expect, test } from '@playwright/test'
import { CLICK_SCENARIO_IDS, PAGES } from '../src/fixtures'
import { runIf, seedIdentifiedProfile, skipIf } from './utils'

test.describe('Variant Resolution (CSR)', () => {
  test.describe('unidentified user', () => {
    runIf('CSR')
    test.use({ storageState: { cookies: [], origins: [] } })

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

      const continentEntry = page.getByTestId(`entry-text-${CLICK_SCENARIO_IDS.direct}`)
      await expect(
        continentEntry
          .getByText('This is a variant content entry for visitors from Europe.')
          .or(
            continentEntry.getByText(
              'This is a baseline content entry for visitors from any continent.',
            ),
          ),
      ).toBeVisible()

      const deviceEntry = page.getByTestId(`entry-text-${CLICK_SCENARIO_IDS.descendant}`)
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

    test('displays unidentified user variants', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Auto Observed Entries' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Manually Observed Entries' })).toBeVisible()

      await expect(page.getByText('This is a level 0 nested baseline entry.')).toBeVisible()
      await expect(page.getByText('This is a level 1 nested baseline entry.')).toBeVisible()
      await expect(page.getByText('This is a level 2 nested baseline entry.')).toBeVisible()

      const visitorVariant = page.getByTestId(`entry-text-${PAGES.home.liveUpdates}`)
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
        page.getByText(
          'This is a baseline content entry for all identified or unidentified users.',
        ),
      ).toBeVisible()
    })
  })

  test.describe('identified user', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test.beforeEach(async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')
      await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()

      await page.getByTestId('consent-button').click()
      await expect(page.getByTestId('consent-status')).toHaveText('Yes')

      await page.getByTestId('identify-button').click()
      await expect(page.getByTestId('reset-button')).toBeVisible()

      await page.reload()
      await page.waitForLoadState('domcontentloaded')
      await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
      await expect(page.getByTestId('reset-button')).toBeVisible()
    })

    test('displays common variants', async ({ page }) => {
      await expect(
        page.getByText(
          'This is a merge tag content entry that displays the visitor\'s continent "EU" embedded within the text.',
        ),
      ).toBeVisible()

      const continentEntry = page.getByTestId(`entry-text-${CLICK_SCENARIO_IDS.direct}`)
      await expect(
        continentEntry
          .getByText('This is a variant content entry for visitors from Europe.')
          .or(
            continentEntry.getByText(
              'This is a baseline content entry for visitors from any continent.',
            ),
          ),
      ).toBeVisible()

      const deviceEntry = page.getByTestId(`entry-text-${CLICK_SCENARIO_IDS.descendant}`)
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

    test('renders identified variants', async ({ page }) => {
      await expect(page.getByText('This is a level 0 nested variant entry.')).toBeVisible()
      await expect(page.getByText('This is a level 1 nested variant entry.')).toBeVisible()
      await expect(page.getByText('This is a level 2 nested variant entry.')).toBeVisible()

      await expect(
        page
          .getByTestId(`entry-text-${PAGES.home.liveUpdates}`)
          .getByText('This is a variant content entry for return visitors.'),
      ).toBeVisible()
      await expect(
        page.getByText('This is a variant content entry for an A/B/C experiment: B'),
      ).toBeVisible()
      await expect(
        page.getByText('This is a variant content entry for visitors with a custom event.'),
      ).toBeVisible()
      await expect(
        page.getByText('This is a variant content entry for identified users.'),
      ).toBeVisible()
    })

    test('reset persists unidentified state across reload', async ({ page }) => {
      await page.getByTestId('reset-button').click()
      await expect(page.getByTestId('identify-button')).toBeVisible()

      await page.reload()
      await page.waitForLoadState('domcontentloaded')
      await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()

      await expect(page.getByTestId('identify-button')).toBeVisible()
      await expect(
        page.getByText(
          'This is a baseline content entry for all identified or unidentified users.',
        ),
      ).toBeVisible()
      await expect(page.getByText('This is a level 0 nested baseline entry.')).toBeVisible()
      await expect(
        page.getByText('This is a variant content entry for identified users.'),
      ).toHaveCount(0)
    })
  })
})

test.describe('Variant Resolution (SSR, JavaScript disabled)', () => {
  runIf('SSR')
  skipIf('SKIP_NO_JS')
  test.use({ javaScriptEnabled: false })

  test.describe('unidentified user', () => {
    test.beforeEach(async ({ baseURL, context, page }) => {
      const profileId = crypto.randomUUID()
      await context.addCookies([
        { name: 'app-personalization-consent', value: 'granted', url: baseURL },
        { name: 'ctfl-opt-aid', value: profileId, url: baseURL },
      ])

      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')
    })

    test('displays common variants', async ({ page }) => {
      await expect(
        page.getByText(
          'This is a merge tag content entry that displays the visitor\'s continent "EU" embedded within the text.',
        ),
      ).toBeVisible()

      const continentEntry = page.getByTestId(`entry-text-${CLICK_SCENARIO_IDS.direct}`)
      await expect(
        continentEntry
          .getByText('This is a variant content entry for visitors from Europe.')
          .or(
            continentEntry.getByText(
              'This is a baseline content entry for visitors from any continent.',
            ),
          ),
      ).toBeVisible()

      const deviceEntry = page.getByTestId(`entry-text-${CLICK_SCENARIO_IDS.descendant}`)
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

    test('displays unidentified user variants', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Auto Observed Entries' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Manually Observed Entries' })).toBeVisible()

      await expect(page.getByText('This is a level 0 nested baseline entry.')).toBeVisible()
      await expect(page.getByText('This is a level 1 nested baseline entry.')).toBeVisible()
      await expect(page.getByText('This is a level 2 nested baseline entry.')).toBeVisible()

      const visitorVariant = page.getByTestId(`entry-text-${PAGES.home.liveUpdates}`)
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
        page.getByText(
          'This is a baseline content entry for all identified or unidentified users.',
        ),
      ).toBeVisible()
    })
  })

  test.describe('identified user', () => {
    test.beforeEach(async ({ baseURL, context, page, request }) => {
      const profileId = crypto.randomUUID()
      await seedIdentifiedProfile(request, profileId)
      await context.addCookies([
        { name: 'app-personalization-consent', value: 'granted', url: baseURL },
        { name: 'ctfl-opt-aid', value: profileId, url: baseURL },
      ])

      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')
    })

    test('displays common variants', async ({ page }) => {
      await expect(
        page.getByText(
          'This is a merge tag content entry that displays the visitor\'s continent "EU" embedded within the text.',
        ),
      ).toBeVisible()

      const continentEntry = page.getByTestId(`entry-text-${CLICK_SCENARIO_IDS.direct}`)
      await expect(
        continentEntry
          .getByText('This is a variant content entry for visitors from Europe.')
          .or(
            continentEntry.getByText(
              'This is a baseline content entry for visitors from any continent.',
            ),
          ),
      ).toBeVisible()

      const deviceEntry = page.getByTestId(`entry-text-${CLICK_SCENARIO_IDS.descendant}`)
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

    test('renders identified variants', async ({ page }) => {
      await expect(page.getByText('This is a level 0 nested variant entry.')).toBeVisible()
      await expect(page.getByText('This is a level 1 nested variant entry.')).toBeVisible()
      await expect(page.getByText('This is a level 2 nested variant entry.')).toBeVisible()

      await expect(
        page
          .getByTestId(`entry-text-${PAGES.home.liveUpdates}`)
          .getByText('This is a variant content entry for return visitors.'),
      ).toBeVisible()
      await expect(
        page.getByText('This is a variant content entry for an A/B/C experiment: B'),
      ).toBeVisible()
      await expect(
        page.getByText('This is a variant content entry for visitors with a custom event.'),
      ).toBeVisible()
      await expect(
        page.getByText('This is a variant content entry for identified users.'),
      ).toBeVisible()
    })
  })
})
