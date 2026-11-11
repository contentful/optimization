import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { getAnonymousIdFromCookie, getAnonymousIdFromStorage } from './utils'

const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'

async function visitReturningUser(page: Page, context: BrowserContext): Promise<string> {
  const delivery = page.waitForResponse(
    (response) =>
      response.url().includes('/experience/') &&
      response.request().method() === 'POST' &&
      response.ok(),
  )
  await page.goto('/')
  await expect.poll(async () => await getAnonymousIdFromCookie(context)).toBeTruthy()
  const initialProfileId = await getAnonymousIdFromCookie(context)
  if (initialProfileId === undefined) throw new Error('The first visit did not issue a profile ID.')
  await delivery

  await page.goto('/user/someone')
  await page.waitForLoadState('domcontentloaded')
  return initialProfileId
}

test.describe('identified returning user: cookie', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: APP_PERSONALIZATION_CONSENT_COOKIE,
        value: 'granted',
        domain: 'localhost',
        path: '/',
        sameSite: 'Lax',
      },
    ])
  })

  test('preserves the API-issued profile ID on the next visit', async ({ context, page }) => {
    const initialProfileId = await visitReturningUser(page, context)
    await expect.poll(async () => await getAnonymousIdFromCookie(context)).toBe(initialProfileId)
  })

  test('syncs the returned profile ID between cookie and localStorage', async ({
    context,
    page,
  }) => {
    const initialProfileId = await visitReturningUser(page, context)
    await expect.poll(async () => await getAnonymousIdFromStorage(context)).toBe(initialProfileId)
  })

  test('displays common variants', async ({ context, page }) => {
    await visitReturningUser(page, context)
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

  test('displays identified user variants', async ({ context, page }) => {
    await visitReturningUser(page, context)
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
