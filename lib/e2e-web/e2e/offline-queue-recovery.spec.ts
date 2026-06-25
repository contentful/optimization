import { type BrowserContext, type Page, expect, test } from '@playwright/test'
import { skipIf } from './utils'

async function getRawEventsCount(page: Page): Promise<number> {
  const text = await page.getByTestId('raw-events-count').innerText()
  return Number.parseInt(text, 10)
}

async function expectRawEventsToIncrease(page: Page, baselineCount: number): Promise<void> {
  await expect.poll(async () => await getRawEventsCount(page)).toBeGreaterThan(baselineCount)
}

async function setOffline(context: BrowserContext, offline: boolean): Promise<void> {
  await context.setOffline(offline)
}

async function waitForBaseUi(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
  await expect(page.getByTestId('raw-events-count')).toBeVisible()
}

test.describe('Offline Queue Recovery', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await setOffline(context, false)
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await waitForBaseUi(page)
  })

  test.afterEach(async ({ context }) => {
    await setOffline(context, false)
  })

  test('continues tracking Insights API events while offline', async ({ context, page }) => {
    skipIf('SSR')
    const baselineCount = await getRawEventsCount(page)

    await setOffline(context, true)
    await page.getByTestId('link-page-two').click()
    await expect(page.getByTestId('page-two-view')).toBeVisible()
    await page.getByTestId('track-conversion-button').click()
    await expectRawEventsToIncrease(page, baselineCount)
  })

  test('recovers gracefully when network is restored', async ({ context, page }) => {
    skipIf('SSR')
    await setOffline(context, true)
    await page.getByTestId('link-page-two').click()
    await expect(page.getByTestId('page-two-view')).toBeVisible()

    await setOffline(context, false)
    await page.getByTestId('link-back-home').click()
    await waitForBaseUi(page)
    await expect(page.getByTestId('identify-button')).toBeVisible()
  })

  test('remains stable across rapid network state changes', async ({ context, page }) => {
    await setOffline(context, true)
    await setOffline(context, false)
    await setOffline(context, true)
    await setOffline(context, false)

    await waitForBaseUi(page)
    await expect(page.getByTestId('identify-button')).toBeVisible()
    const baselineCount = await getRawEventsCount(page)
    await page.getByTestId('link-page-two').click()
    await expect(page.getByTestId('page-two-view')).toBeVisible()
    await page.getByTestId('track-conversion-button').click()
    await expectRawEventsToIncrease(page, baselineCount)
  })

  test('queues identify event offline and updates identified state when online', async ({
    context,
    page,
  }) => {
    const baselineCount = await getRawEventsCount(page)

    await setOffline(context, true)
    await page.getByTestId('identify-button').click()
    await expectRawEventsToIncrease(page, baselineCount)
    await expect(page.getByTestId('identified-status')).toHaveText('No')

    await setOffline(context, false)
    await expect(page.getByTestId('reset-button')).toBeVisible()
    await expect(page.getByTestId('identified-status')).toHaveText('Yes')
  })
})
