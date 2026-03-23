import { expect, test, type Locator, type Page } from '@playwright/test'

declare const window: {
  contentfulOptimization?: { getFlag: (name: string) => unknown }
}

async function getBooleanFlagValue(page: Page): Promise<unknown> {
  return await page.evaluate(() => window.contentfulOptimization?.getFlag('boolean'))
}

async function selectPreviewVariant(
  personalization: Locator,
  variantLabel: 'Baseline' | 'Variant 1',
): Promise<void> {
  await personalization.getByLabel(variantLabel).evaluate((input: { click: () => void }) => {
    input.click()
  })
}

test.describe('preview panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')
  })

  test('is attached and opens/closes', async ({ page }) => {
    const previewPanel = page.locator('ctfl-opt-preview-panel')
    const drawerToggle = previewPanel.locator('button.toggle-drawer')
    const close = previewPanel.getByRole('button', { name: 'Close' })

    await expect(previewPanel).toHaveCount(1)
    await expect(drawerToggle).toBeVisible()

    const drawerToggleClassName = (await drawerToggle.getAttribute('class')) ?? ''
    if (drawerToggleClassName.includes('opened')) {
      await drawerToggle.click()
    }
    await expect(drawerToggle).toHaveClass(/closed/)

    await drawerToggle.click()
    await expect(drawerToggle).toHaveClass(/opened/)
    await expect(close).toBeVisible()

    await close.click()
    await expect(drawerToggle).toHaveClass(/closed/)
  })

  test('selects custom flag variants through the preview panel', async ({ page }) => {
    const previewPanel = page.locator('ctfl-opt-preview-panel')
    const drawerToggle = previewPanel.locator('button.toggle-drawer')

    await page.getByRole('button', { name: 'Accept Consent' }).click()
    await page.getByRole('button', { name: 'Identify' }).click()

    await expect.poll(async () => await getBooleanFlagValue(page)).toBe(true)

    const drawerToggleClassName = (await drawerToggle.getAttribute('class')) ?? ''
    if (drawerToggleClassName.includes('closed')) {
      await drawerToggle.click()
    }

    const flagPersonalization = previewPanel
      .locator('ctfl-opt-preview-personalization')
      .filter({ hasText: '[Custom Flag] Boolean Flag' })

    await expect(flagPersonalization).toHaveCount(1)
    await flagPersonalization.scrollIntoViewIfNeeded()

    await selectPreviewVariant(flagPersonalization, 'Baseline')
    await expect.poll(async () => await getBooleanFlagValue(page)).toBe(false)

    await selectPreviewVariant(flagPersonalization, 'Variant 1')
    await expect.poll(async () => await getBooleanFlagValue(page)).toBe(true)

    await previewPanel.getByRole('button', { name: 'Reset Profile' }).click()
    await expect.poll(async () => await getBooleanFlagValue(page)).toBe(true)
  })

  test('filters audiences by audience and personalization names', async ({ page }) => {
    const previewPanel = page.locator('ctfl-opt-preview-panel')
    const drawerToggle = previewPanel.locator('button.toggle-drawer')
    const search = previewPanel.getByRole('searchbox', {
      name: 'Search audiences and personalizations',
    })
    const audiences = previewPanel.locator('ctfl-opt-preview-audience')

    const drawerToggleClassName = (await drawerToggle.getAttribute('class')) ?? ''
    if (drawerToggleClassName.includes('closed')) {
      await drawerToggle.click()
    }

    expect(await audiences.count()).toBeGreaterThan(1)

    await search.fill('  rOPe vis  ')

    await expect(audiences).toHaveCount(1)
    await expect(audiences.first()).toContainText('Europe Visitors')
    await expect(
      audiences.first().locator('.audience-name ctfl-opt-preview-matched-text .match'),
    ).toHaveText(['rope', 'Vis'])

    await search.fill('euorpe visitors')

    await expect(audiences).toHaveCount(1)
    await expect(audiences.first()).toContainText('Europe Visitors')

    await search.fill('fLaG')

    await expect(audiences).toHaveCount(1)
    await expect(audiences.first()).toContainText('All Visitors')
    await expect(audiences.first()).toContainText('[Custom Flag] Boolean Flag')
    const flagPersonalization = audiences
      .first()
      .locator('ctfl-opt-preview-personalization')
      .filter({ hasText: '[Custom Flag] Boolean Flag' })
    await expect(
      flagPersonalization.locator('legend ctfl-opt-preview-matched-text .match'),
    ).toHaveText(['Flag'])

    await search.fill('does not exist')

    await expect(audiences).toHaveCount(0)
    await expect(previewPanel).toContainText('No results were found for your search.')
    await expect(previewPanel).toContainText('Try again with a different term.')
  })
})
