import { expect, test } from '@playwright/test'

const variantEntryTexts: Record<string, string> = {
  '1JAU028vQ7v6nB2swl3NBo': 'This is a level 0 nested baseline entry.',
  '5i4SdJXw9oDEY0vgO7CwF4': 'This is a level 1 nested baseline entry.',
  uaNY4YJ0HFPAX3gKXiRdX: 'This is a level 2 nested baseline entry.',
  '1MwiFl4z7gkwqGYdvCmr8c':
    'This is a merge tag content entry that displays the visitor\'s continent "EU" embedded within the text.',
  '4k6ZyFQnR2POY5IJLLlJRb': 'This is a variant content entry for visitors from Europe.',
  '6iyPl6vfDH5AoClf3MtYlh': 'This is a variant content entry for visitors using a desktop browser.',
  '1UFf7qr4mHET3HYuYmcpEj': 'This is a variant content entry for new visitors.',
  '4bmHsNUaEibELHwWCon3dt': 'This is a variant content entry for an A/B/C experiment: B',
  '6zqoWXyiSrf0ja7I2WGtYj':
    'This is a baseline content entry for all visitors with or without a custom event.',
  '7pa5bOx8Z9NmNcr7mISvD':
    'This is a baseline content entry for all identified or unidentified users.',
}

test.describe('events', () => {
  test.describe('without consent', () => {
    test.beforeEach(async ({ page }) => {
      await page.clock.install({ time: new Date() })
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')
    })

    test('page event has been emitted', async ({ page }) => {
      await expect(
        page.getByRole('listitem').filter({ has: page.getByRole('button', { name: 'page' }) }),
      ).toBeVisible()
    })

    test('component view events have not been emitted', async ({ page }) => {
      for (const entryText of Object.values(variantEntryTexts)) {
        const element = page.getByText(entryText)

        await element.scrollIntoViewIfNeeded()

        await page.clock.fastForward('02:00')
      }

      const allComponentEvents = await page
        .getByRole('listitem')
        .filter({ has: page.getByRole('button', { name: 'component' }) })
        .all()

      expect(allComponentEvents.length).toEqual(0)
    })
  })

  test.describe('with consent', () => {
    test.beforeEach(async ({ page }) => {
      await page.clock.install({ time: new Date() })
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')

      const consent = page.getByRole('button', { name: 'Accept Consent' })
      await consent.click()
    })

    test('page event has been emitted', async ({ page }) => {
      await expect(
        page.getByRole('listitem').filter({ has: page.getByRole('button', { name: 'page' }) }),
      ).toBeVisible()
    })

    test('component view events have been emitted', async ({ page }) => {
      for (const entryId of Object.keys(variantEntryTexts)) {
        const entryText = variantEntryTexts[entryId]

        if (!entryText) continue

        const element = page.getByText(entryText)

        await element.scrollIntoViewIfNeeded()

        await page.clock.fastForward('02:00')

        expect(await page.getByTestId(entryId).innerText()).toEqual('component')
      }

      const allComponentEvents = await page
        .getByRole('listitem')
        .filter({ has: page.getByRole('button', { name: 'component' }) })
        .all()

      expect(allComponentEvents.length).toEqual(10)
    })
  })
})
