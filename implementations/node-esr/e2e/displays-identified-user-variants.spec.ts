import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node'
import { type BrowserContext, expect, test } from '@playwright/test'
const ANONYMOUS_ID = '__ctfl_opt_anonymous_id__'

async function getAnonymousIdFromCookie(context: BrowserContext): Promise<string | undefined> {
  const cookies = await context.cookies()
  return cookies.find((cookie) => cookie.name === ANONYMOUS_ID_COOKIE)?.value
}

async function getAnonymousIdFromStorage(context: BrowserContext): Promise<string | undefined> {
  const state = await context.storageState()
  const storage = state.origins[0]?.localStorage ?? []
  return storage.find((item) => item.name === ANONYMOUS_ID)?.value
}

test.describe('identified user', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/user/someone`)
    await page.waitForLoadState('domcontentloaded')
  })

  test('profile id is stored in localStorage and taken from cookies', async ({ context }) => {
    const cookieId = await getAnonymousIdFromCookie(context)
    const storedId = await getAnonymousIdFromStorage(context)
    
    expect(cookieId).toBeDefined()
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
