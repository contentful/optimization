import { expect, test } from '@playwright/test'
import { getAnonymousIdFromCookie, getAnonymousIdFromStorage } from './utils'

test.describe('identified user', () => {
  test.beforeEach(async ({ page }) => {
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
