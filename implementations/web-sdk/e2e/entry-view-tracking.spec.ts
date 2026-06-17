import { expect, test, type Locator, type Page } from '@playwright/test'

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

const MANUAL_VIEW_BASELINE_ENTRY_ID = '5XHssysWUDECHzKLzoIsg1'

function getRenderedEntries(page: Page): Locator {
  return page.locator('#auto-observed, #manually-observed')
}

test.describe('entry view tracking', () => {
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

    test('entry view events have not been emitted', async ({ page }) => {
      const renderedEntries = getRenderedEntries(page)

      for (const entryText of Object.values(variantEntryTexts)) {
        const element = renderedEntries.getByText(entryText)

        await element.scrollIntoViewIfNeeded()

        await page.clock.fastForward('02:00')
      }

      await expect(page.locator('#event-stream li button[data-view-id]')).toHaveCount(0)
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

    test('entry view events have been emitted', async ({ page }) => {
      const renderedEntries = getRenderedEntries(page)

      for (const entryId of Object.keys(variantEntryTexts)) {
        const entryText = variantEntryTexts[entryId]

        if (!entryText) continue

        const element = renderedEntries.getByText(entryText)

        await element.scrollIntoViewIfNeeded()

        await page.clock.fastForward('02:00')

        await expect(
          page
            .locator(`#event-stream li button[data-component-id="${entryId}"][data-view-id]`)
            .first(),
        ).toBeVisible()
      }

      const allEntryEvents = page.locator(
        '#event-stream li button[data-view-id]:not([data-component-id="boolean"])',
      )

      await expect.poll(async () => await allEntryEvents.count()).toBeGreaterThanOrEqual(10)

      const viewIdButtons = allEntryEvents
      const viewIds: string[] = []
      const viewIdCount = await viewIdButtons.count()

      for (let index = 0; index < viewIdCount; index += 1) {
        const viewId = await viewIdButtons.nth(index).getAttribute('data-view-id')

        expect(viewId).not.toBeNull()
        if (viewId) viewIds.push(viewId)
      }

      expect(new Set(viewIds).size).toEqual(viewIds.length)
    })

    test('manual view example emits one view event without auto double tracking', async ({
      page,
    }) => {
      const manualEntry = page.getByTestId('manual-view-entry')

      await expect(manualEntry).toHaveAttribute('track-views', 'false')
      await expect(manualEntry).toHaveAttribute('data-ctfl-track-views', 'false')
      await expect(manualEntry).toHaveAttribute('data-ctfl-entry-id', /.+/)

      const resolvedEntryId = await manualEntry.getAttribute('data-ctfl-entry-id')
      expect(resolvedEntryId).not.toBeNull()

      await page.getByTestId(`content-${MANUAL_VIEW_BASELINE_ENTRY_ID}`).scrollIntoViewIfNeeded()
      await page.clock.fastForward('02:00')

      await expect(
        page.locator(
          `#event-stream li button[data-component-id="${resolvedEntryId}"][data-view-id]`,
        ),
      ).toHaveCount(1)
    })
  })
})
