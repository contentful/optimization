import { expect, test } from '@playwright/test'
import { getAnonymousIdFromCookie, getAnonymousIdFromStorage } from './utils'

test.describe('unidentified user', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
  })

  test('does not store profile continuity before app consent', async ({ context }) => {
    await expect.poll(async () => await getAnonymousIdFromCookie(context)).toBeUndefined()
    await expect.poll(async () => await getAnonymousIdFromStorage(context)).toBeUndefined()
  })

  test('displays common baselines before app consent', async ({ page }) => {
    await expect(
      page.getByText('This is a baseline content entry for visitors from any continent.'),
    ).toBeVisible()

    await expect(
      page.getByText('This is a baseline content entry for all visitors using any device.'),
    ).toBeVisible()
  })

  test('displays unidentified user baselines before app consent', async ({ page }) => {
    await expect(page.getByText('This is a level 0 nested baseline entry.')).toBeVisible()

    await expect(page.getByText('This is a level 1 nested baseline entry.')).toBeVisible()

    await expect(page.getByText('This is a level 2 nested baseline entry.')).toBeVisible()

    await expect(page.getByText('This is a baseline content entry for all users.')).toBeVisible()

    await expect(
      page.getByText('This is a baseline content entry for an A/B/C experiment: A'),
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
