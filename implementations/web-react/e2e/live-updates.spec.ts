import { type Locator, type Page, expect, test } from '@playwright/test'

async function getEntryId(locator: Locator): Promise<string> {
  const text = await locator.innerText()
  return text.replace('Entry: ', '').trim()
}

async function identify(page: Page): Promise<void> {
  await page.getByTestId('live-updates-identify-button').click()
  await expect(page.getByTestId('identified-status')).toHaveText('Yes')
}

test.describe('live updates behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
    await expect(page.getByTestId('preview-panel-status')).toHaveText('Closed')
    await expect(page.getByTestId('global-live-updates-status')).toHaveText('OFF')
    await expect(page.getByTestId('identified-status')).toHaveText('No')
    await expect
      .poll(async () => {
        const text = await page.getByTestId('personalizations-count').innerText()
        const value = Number.parseInt(text.replace('Personalizations: ', ''), 10)
        return Number.isNaN(value) ? 0 : value
      })
      .toBeGreaterThan(0)
  })

  test('default behavior locks to first value when global live updates is OFF', async ({
    page,
  }) => {
    const initialDefaultEntryId = await getEntryId(page.getByTestId('default-entry-id'))

    await identify(page)

    await expect(page.getByTestId('default-entry-id')).toHaveText(`Entry: ${initialDefaultEntryId}`)
  })

  test('global live updates ON updates default component while locked component stays fixed', async ({
    page,
  }) => {
    await page.getByTestId('toggle-global-live-updates-button').click()
    await expect(page.getByTestId('global-live-updates-status')).toHaveText('ON')

    const initialDefaultEntryId = await getEntryId(page.getByTestId('default-entry-id'))
    const initialLockedEntryId = await getEntryId(page.getByTestId('locked-entry-id'))

    await identify(page)

    await expect
      .poll(async () => await getEntryId(page.getByTestId('default-entry-id')))
      .not.toBe(initialDefaultEntryId)
    await expect(page.getByTestId('locked-entry-id')).toHaveText(`Entry: ${initialLockedEntryId}`)
  })

  test('per-component liveUpdates=true updates even when global live updates is OFF', async ({
    page,
  }) => {
    const initialLiveEntryId = await getEntryId(page.getByTestId('live-entry-id'))

    await identify(page)

    await expect
      .poll(async () => await getEntryId(page.getByTestId('live-entry-id')))
      .not.toBe(initialLiveEntryId)
  })

  test('preview-panel override enables updates for locked components', async ({ page }) => {
    const initialLockedEntryId = await getEntryId(page.getByTestId('locked-entry-id'))

    await page.getByTestId('simulate-preview-panel-button').click()
    await expect(page.getByTestId('preview-panel-status')).toHaveText('Open')

    await identify(page)

    await expect
      .poll(async () => await getEntryId(page.getByTestId('locked-entry-id')))
      .not.toBe(initialLockedEntryId)
  })

  test('screen controls toggle global live updates and preview panel', async ({ page }) => {
    await expect(page.getByTestId('global-live-updates-status')).toHaveText('OFF')
    await page.getByTestId('toggle-global-live-updates-button').click()
    await expect(page.getByTestId('global-live-updates-status')).toHaveText('ON')
    await page.getByTestId('toggle-global-live-updates-button').click()
    await expect(page.getByTestId('global-live-updates-status')).toHaveText('OFF')

    await expect(page.getByTestId('preview-panel-status')).toHaveText('Closed')
    await page.getByTestId('simulate-preview-panel-button').click()
    await expect(page.getByTestId('preview-panel-status')).toHaveText('Open')
    await page.getByTestId('simulate-preview-panel-button').click()
    await expect(page.getByTestId('preview-panel-status')).toHaveText('Closed')
  })

  test('screen controls identify and reset user', async ({ page }) => {
    await expect(page.getByTestId('identified-status')).toHaveText('No')
    await page.getByTestId('live-updates-identify-button').click()
    await expect(page.getByTestId('identified-status')).toHaveText('Yes')
    await page.getByTestId('live-updates-reset-button').click()
    await expect(page.getByTestId('identified-status')).toHaveText('No')
  })

  test('renders all three personalization sections and entry content', async ({ page }) => {
    await expect(page.getByTestId('default-personalization')).toBeVisible()
    await expect(page.getByTestId('live-personalization')).toBeVisible()
    await expect(page.getByTestId('locked-personalization')).toBeVisible()

    await expect(page.getByTestId('default-container')).toBeVisible()
    await expect(page.getByTestId('live-container')).toBeVisible()
    await expect(page.getByTestId('locked-container')).toBeVisible()

    await expect(page.getByTestId('default-text')).toBeVisible()
    await expect(page.getByTestId('live-text')).toBeVisible()
    await expect(page.getByTestId('locked-text')).toBeVisible()
    await expect(page.getByTestId('default-entry-id')).toBeVisible()
    await expect(page.getByTestId('live-entry-id')).toBeVisible()
    await expect(page.getByTestId('locked-entry-id')).toBeVisible()
  })
})
