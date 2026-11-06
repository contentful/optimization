import { expect, test, type Route } from '@playwright/test'
import { getAnonymousIdFromCookie, getAnonymousIdFromStorage } from './utils'

const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'

test.describe('identified user', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.addCookies([
      {
        name: APP_PERSONALIZATION_CONSENT_COOKIE,
        value: 'granted',
        domain: 'localhost',
        path: '/',
        sameSite: 'Lax',
      },
    ])
    await page.goto(`/user/someone`)
    await page.waitForLoadState('domcontentloaded')
  })

  test('should store profile id in cookie', async ({ context }) => {
    const cookieId = await getAnonymousIdFromCookie(context)
    expect(cookieId).toBeDefined()
  })

  test('should sync profile id between cookie and localStorage', async ({ context }) => {
    const cookieId = await getAnonymousIdFromCookie(context)
    const storedId = await getAnonymousIdFromStorage(context)

    expect(storedId).toBeDefined()
    expect(storedId).toEqual(cookieId)
  })

  test('displays common variants', async ({ page }) => {
    await expect(
      page.getByText(
        'This is a merge tag content entry that displays the visitor\'s continent "EU" embedded within the text.',
      ),
    ).toBeVisible()

    await expect(
      page.getByText('This is a variant content entry for visitors from Europe.'),
    ).toBeVisible()

    await expect(
      page.getByText('This is a variant content entry for visitors using a desktop browser.'),
    ).toBeVisible()
  })

  test('displays identified user variants', async ({ page }) => {
    await expect(page.getByText('This is a level 0 nested variant entry.')).toBeVisible()

    await expect(page.getByText('This is a level 1 nested variant entry.')).toBeVisible()

    await expect(page.getByText('This is a level 2 nested variant entry.')).toBeVisible()

    await expect(
      page.getByText('This is a variant content entry for return visitors.'),
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

test('commits a prepared identified visit in the browser without a duplicate page', async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: APP_PERSONALIZATION_CONSENT_COOKIE,
      value: 'granted',
      domain: 'localhost',
      path: '/',
      sameSite: 'Lax',
    },
  ])
  const delivery = page.waitForResponse(
    (response) =>
      response.url().includes('/experience/') &&
      response.request().method() === 'POST' &&
      response.ok(),
  )

  await page.goto('/user/someone')
  await expect(
    page.getByText('This is a variant content entry for identified users.'),
  ).toBeVisible()
  await delivery
  await expect(
    page.getByRole('listitem').filter({ has: page.getByRole('button', { name: 'page' }) }),
  ).toHaveCount(1)
})

test('keeps personalized content visible when browser delivery is delayed and fails', async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: APP_PERSONALIZATION_CONSENT_COOKIE,
      value: 'granted',
      domain: 'localhost',
      path: '/',
      sameSite: 'Lax',
    },
  ])
  let release = (): void => undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let held = false
  let failed = false
  const routeHandler = async (route: Route): Promise<void> => {
    if (held || route.request().method() !== 'POST') {
      await route.continue()
      return
    }
    held = true
    await gate
    await route.abort('failed')
    failed = true
  }
  await page.route('**/experience/**', routeHandler)

  try {
    await page.goto('/user/someone', { waitUntil: 'domcontentloaded' })
    await expect.poll(() => held).toBe(true)
    const identifiedContent = page.getByText(
      'This is a variant content entry for identified users.',
    )
    await expect(identifiedContent).toBeVisible()

    release()
    await expect.poll(() => failed).toBe(true)
    await expect(identifiedContent).toBeVisible()
  } finally {
    release()
    await page.unroute('**/experience/**', routeHandler)
  }
})
