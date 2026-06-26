import { type Locator, type Page, expect, test } from '@playwright/test'
import { isPreviewPanelEnabled, onlyWithPreviewPanel } from './utils'

async function getEntryId(locator: Locator): Promise<string> {
  return (await locator.getAttribute('data-test-entry-id')) ?? ''
}

async function identify(page: Page): Promise<void> {
  await page.getByTestId('identify-button').click()
  await expect(page.getByTestId('identified-status')).toHaveText('Yes')
}

test.describe('Live Updates', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
    await expect(page.getByTestId('preview-panel-status')).toHaveText('Closed')
    await expect(page.getByTestId('global-live-updates-status')).toHaveText('OFF')
    await expect(page.getByTestId('identified-status')).toHaveText('No')
    if (isPreviewPanelEnabled) {
      await expect
        .poll(async () => await page.locator('ctfl-opt-preview-panel').count())
        .toBeGreaterThan(0)
    } else {
      await expect(page.locator('ctfl-opt-preview-panel')).toHaveCount(0)
    }
    await expect(page.getByTestId('live-updates-examples')).toBeVisible()
    await expect
      .poll(async () => {
        const text = await page.getByTestId('selected-optimizations-count').innerText()
        const value = Number.parseInt(text, 10)
        return Number.isNaN(value) ? 0 : value
      })
      .toBeGreaterThan(0)
  })

  test('default behavior locks to first value when global live updates is OFF', async ({
    page,
  }) => {
    const initialDefaultEntryId = await getEntryId(page.getByTestId('content-live-default'))

    await identify(page)

    await expect(page.getByTestId('content-live-default')).toHaveAttribute(
      'data-test-entry-id',
      initialDefaultEntryId,
    )
  })

  test('global live updates ON updates the default entry while the locked entry stays fixed', async ({
    page,
  }) => {
    await page.getByTestId('toggle-global-live-updates-button').click()
    await expect(page.getByTestId('global-live-updates-status')).toHaveText('ON')

    const initialDefaultEntryId = await getEntryId(page.getByTestId('content-live-default'))
    const initialLockedEntryId = await getEntryId(page.getByTestId('content-live-locked'))

    await identify(page)

    await expect
      .poll(async () => await getEntryId(page.getByTestId('content-live-default')))
      .not.toBe(initialDefaultEntryId)
    await expect(page.getByTestId('content-live-locked')).toHaveAttribute(
      'data-test-entry-id',
      initialLockedEntryId,
    )
  })

  test('per-component liveUpdates=true updates even when global live updates is OFF', async ({
    page,
  }) => {
    const initialLiveEntryId = await getEntryId(page.getByTestId('content-live-enabled'))

    await identify(page)

    await expect
      .poll(async () => await getEntryId(page.getByTestId('content-live-enabled')))
      .not.toBe(initialLiveEntryId)
  })

  test('preview-panel override enables updates for locked entries', async ({ page }) => {
    onlyWithPreviewPanel()
    const initialLockedEntryId = await getEntryId(page.getByTestId('content-live-locked'))

    await page.getByTestId('simulate-preview-panel-button').click()
    await expect(page.getByTestId('preview-panel-status')).toHaveText('Open')

    await identify(page)

    await expect
      .poll(async () => await getEntryId(page.getByTestId('content-live-locked')))
      .not.toBe(initialLockedEntryId)
  })

  test('screen controls toggle global live updates and preview panel', async ({ page }) => {
    onlyWithPreviewPanel()
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
    await page.getByTestId('identify-button').click()
    await expect(page.getByTestId('identified-status')).toHaveText('Yes')
    await page.getByTestId('reset-button').click()
    await expect(page.getByTestId('identified-status')).toHaveText('No')
  })

  test('renders default, enabled, and locked examples', async ({ page }) => {
    await expect(page.getByTestId('content-live-default')).toBeVisible()
    await expect(page.getByTestId('content-live-enabled')).toBeVisible()
    await expect(page.getByTestId('content-live-locked')).toBeVisible()

    await expect(page.getByTestId('entry-text-live-default')).toBeVisible()
    await expect(page.getByTestId('entry-text-live-enabled')).toBeVisible()
    await expect(page.getByTestId('entry-text-live-locked')).toBeVisible()
  })
})
