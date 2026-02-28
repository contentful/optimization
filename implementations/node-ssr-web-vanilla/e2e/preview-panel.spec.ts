import { expect, test } from '@playwright/test'

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
})
