import { type APIRequestContext, expect, test } from '@playwright/test'
import { CLICK_SCENARIO_IDS, PAGES } from '../src/fixtures'

const RENDERING_MODE = (process.env.RENDERING_MODE ?? 'csr').toLowerCase()

const MOCK_EXPERIENCE_URL = 'http://localhost:8000/experience'

// Seed the mock so it returns identified-visitor data for this profile ID.
// The mock tracks identified state in-memory via POSTed identify events.
async function seedIdentifiedProfile(request: APIRequestContext, profileId: string): Promise<void> {
  await request.post(
    `${MOCK_EXPERIENCE_URL}/v2/organizations/mock-client-id/environments/main/profiles/${profileId}`,
    {
      data: {
        events: [
          { type: 'identify', properties: { userId: 'charles', traits: { identified: true } } },
        ],
      },
    },
  )
}

test.describe('Variant Resolution (SSR)', () => {
  test.skip(RENDERING_MODE !== 'ssr', 'SSR variant resolution tests only run in SSR mode.')
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
