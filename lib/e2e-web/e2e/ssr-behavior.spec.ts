import { type APIRequestContext, expect, test } from '@playwright/test'

const RENDERING_MODE = (process.env.RENDERING_MODE ?? 'csr').toLowerCase()

const MOCK_API_URL = 'http://localhost:8000/experience'

// Seed the mock so it returns identified-visitor data for this profile ID.
// The mock tracks identified state in-memory via POSTed identify events.
async function seedIdentifiedProfile(request: APIRequestContext, profileId: string): Promise<void> {
  await request.post(
    `${MOCK_API_URL}/v2/organizations/mock-client-id/environments/main/profiles/${profileId}`,
    {
      data: {
        events: [
          { type: 'identify', properties: { userId: 'charles', traits: { identified: true } } },
        ],
      },
    },
  )
}

const SSR_COOKIES = {
  consent: { name: 'app-personalization-consent', value: 'granted' },
} as const

test.describe('server-side tracking attributes', () => {
  test.skip(RENDERING_MODE !== 'ssr', 'Server-side tracking attribute tests only run in SSR mode.')

  test('renders tracking attributes on first paint', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const entry = page.locator('[data-ctfl-entry-id]').first()
    await expect(entry).toBeVisible()
    await expect(entry).toHaveAttribute('data-ctfl-baseline-id', /.+/)
    await expect(entry).toHaveAttribute('data-ctfl-variant-index', /\d+/)
  })

  test('does not issue a client Experience request after consented SSR hydration', async ({
    baseURL,
    context,
    page,
  }) => {
    await context.addCookies([{ ...SSR_COOKIES.consent, url: baseURL }])
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
  test.skip(RENDERING_MODE !== 'ssr', 'Server-side variant resolution tests only run in SSR mode.')
  test.use({ javaScriptEnabled: false })

  test('displays unidentified user variants', async ({ baseURL, context, page }) => {
    const profileId = crypto.randomUUID()
    await context.addCookies([
      { ...SSR_COOKIES.consent, url: baseURL },
      { name: 'ctfl-opt-aid', value: profileId, url: baseURL },
    ])

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByText('This is a level 0 nested baseline entry.')).toBeVisible()
    await expect(page.getByText('This is a level 1 nested baseline entry.')).toBeVisible()
    await expect(page.getByText('This is a level 2 nested baseline entry.')).toBeVisible()
    await expect(
      page.getByText('This is a baseline content entry for all identified or unidentified users.'),
    ).toBeVisible()
  })

  test('displays identified user variants', async ({ baseURL, context, page, request }) => {
    const profileId = crypto.randomUUID()
    await seedIdentifiedProfile(request, profileId)
    await context.addCookies([
      { ...SSR_COOKIES.consent, url: baseURL },
      { name: 'ctfl-opt-aid', value: profileId, url: baseURL },
    ])

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByText('This is a level 0 nested variant entry.')).toBeVisible()
    await expect(page.getByText('This is a level 1 nested variant entry.')).toBeVisible()
    await expect(page.getByText('This is a level 2 nested variant entry.')).toBeVisible()
    await expect(
      page.getByText('This is a variant content entry for identified users.'),
    ).toBeVisible()
  })

  test('renders baseline when consent is denied', async ({ baseURL, context, page, request }) => {
    const profileId = crypto.randomUUID()
    await seedIdentifiedProfile(request, profileId)
    await context.addCookies([
      { name: SSR_COOKIES.consent.name, value: 'denied', url: baseURL },
      { name: 'ctfl-opt-aid', value: profileId, url: baseURL },
    ])

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByText('This is a level 0 nested baseline entry.')).toBeVisible()
    await expect(
      page.getByText('This is a variant content entry for identified users.'),
    ).toHaveCount(0)
  })
})
