import { expect, test } from '@playwright/test'

// Profile ID from lib/mocks/src/experience/data/identified-visitor.json.
// The mock returns identified-visitor data when this ID is sent as the anonymous profile.
const IDENTIFIED_PROFILE_ID = 'f0837a67eed5f1c93978f6d53fa948df93897137bcd048366f30ba590420754b'

// Entry 1JAU028vQ7v6nB2swl3NBo resolves to variant 2KIWllNZJT205BwOSkMINg for the identified
// profile. Texts come from lib/mocks/src/contentful/data/entries/.
const BASELINE_ENTRY_ID = '1JAU028vQ7v6nB2swl3NBo'
const BASELINE_TEXT = 'This is a level 0 nested baseline entry.'
const VARIANT_TEXT = 'This is a level 0 nested variant entry.'

const SSR_COOKIES = {
  consent: { name: 'app-personalization-consent', value: 'granted' },
  profile: { name: 'ctfl-opt-aid', value: IDENTIFIED_PROFILE_ID },
} as const

test.describe('server-side tracking attributes', () => {
  test('renders tracking attributes on first paint', async ({ page }) => {
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
    await context.addCookies([{ ...SSR_COOKIES.consent, url: 'http://localhost:3001' }])
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

test.describe('server-side variant resolution', () => {
  test.use({ javaScriptEnabled: false })

  test('renders baseline entry text when no consent cookie is set', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByTestId(`entry-text-${BASELINE_ENTRY_ID}`)).toContainText(BASELINE_TEXT)
  })

  test('renders resolved variant text when consent and profile cookies are set', async ({
    context,
    page,
  }) => {
    await context.addCookies([
      { ...SSR_COOKIES.consent, url: 'http://localhost:3001' },
      { ...SSR_COOKIES.profile, url: 'http://localhost:3001' },
    ])

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByTestId(`entry-text-${BASELINE_ENTRY_ID}`)).toContainText(VARIANT_TEXT)
  })

  test('renders baseline text when consent is denied', async ({ context, page }) => {
    await context.addCookies([
      { name: SSR_COOKIES.consent.name, value: 'denied', url: 'http://localhost:3001' },
      { ...SSR_COOKIES.profile, url: 'http://localhost:3001' },
    ])

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByTestId(`entry-text-${BASELINE_ENTRY_ID}`)).toContainText(BASELINE_TEXT)
  })
})
