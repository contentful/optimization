import { expect, test } from '@playwright/test'

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
      const entryTexts = [
        'This is a merge tag content entry that displays the visitor\'s continent "EU" embedded within the text.',
        'This is a variant content entry for visitors from Europe.',
        'This is a variant content entry for visitors using a desktop browser.',
        'This is a variant content entry for new visitors.',
        'This is a baseline content entry for an A/B/C experiment: A',
        'This is a baseline content entry for all visitors with or without a custom event.',
        'This is a baseline content entry for all identified or unidentified users.',
      ]

      for (const entryText of entryTexts) {
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
      const entryTexts = [
        'This is a merge tag content entry that displays the visitor\'s continent "EU" embedded within the text.',
        'This is a variant content entry for visitors from Europe.',
        'This is a variant content entry for visitors using a desktop browser.',
        'This is a variant content entry for new visitors.',
        'This is a baseline content entry for an A/B/C experiment: A',
        'This is a baseline content entry for all visitors with or without a custom event.',
        'This is a baseline content entry for all identified or unidentified users.',
      ]

      for (const entryText of entryTexts) {
        const element = page.getByText(entryText)

        await element.scrollIntoViewIfNeeded()

        await page.clock.fastForward('02:00')
      }

      const allComponentEvents = await page
        .getByRole('listitem')
        .filter({ has: page.getByRole('button', { name: 'component' }) })
        .all()

      expect(allComponentEvents.length).toEqual(7)
    })
  })
})
