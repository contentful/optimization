import { type Page, expect, test } from '@playwright/test'
import { CLICK_SCENARIO_IDS } from '../src/fixtures'

interface HoverScenario {
  name: string
  hoverTargetTestId: string
}

const HOVER_ENTRY_BASELINE_ID = CLICK_SCENARIO_IDS.direct

const hoverScenarios: HoverScenario[] = [
  {
    name: 'entry container',
    hoverTargetTestId: `content-${HOVER_ENTRY_BASELINE_ID}`,
  },
  {
    name: 'descendant content node',
    hoverTargetTestId: `entry-text-${HOVER_ENTRY_BASELINE_ID}`,
  },
]

async function movePointerAwayFromEntries(page: Page): Promise<void> {
  await page.getByRole('heading', { name: 'Utilities' }).hover()
}

async function readHoverEventId(page: Page): Promise<string> {
  return (await page.locator('[data-hover-id]').first().getAttribute('data-hover-id')) ?? ''
}

async function readHoverDurationMs(page: Page, hoverId: string): Promise<number> {
  const value = await page
    .locator(`[data-hover-id="${hoverId}"]`)
    .getAttribute('data-hover-duration-ms')
  return value !== null ? Number.parseInt(value, 10) : Number.NaN
}

test.describe('entry hover tracking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
  })

  test('does not emit entry hover events without consent', async ({ page }) => {
    for (const scenario of hoverScenarios) {
      const target = page.getByTestId(scenario.hoverTargetTestId)
      await expect(target, `${scenario.name}: hover target should render`).toBeVisible()

      await target.scrollIntoViewIfNeeded()
      await target.hover()
      await page.waitForTimeout(1200)
      await movePointerAwayFromEntries(page)
    }

    await expect(page.locator('[data-hover-id]')).toHaveCount(0)
  })

  test('emits entry hover events for entry container and descendant hovers after consent', async ({
    page,
  }) => {
    await page.getByTestId('consent-button').click()

    const hoverEvents = page.locator('[data-hover-id]')

    for (const scenario of hoverScenarios) {
      const target = page.getByTestId(scenario.hoverTargetTestId)
      const baselineCount = await hoverEvents.count()

      await target.scrollIntoViewIfNeeded()
      await target.hover()

      await expect
        .poll(async () => await hoverEvents.count(), {
          message: `${scenario.name}: hover event count should increase`,
        })
        .toBeGreaterThan(baselineCount)

      await movePointerAwayFromEntries(page)
    }

    await expect.poll(async () => await hoverEvents.count()).toBeGreaterThanOrEqual(2)
  })

  test('updates hover duration while hovered and emits a final update when hover ends', async ({
    page,
  }) => {
    await page.getByTestId('consent-button').click()

    const target = page.getByTestId(`content-${HOVER_ENTRY_BASELINE_ID}`)
    await target.scrollIntoViewIfNeeded()
    await target.hover()

    const hoverEvents = page.locator('[data-hover-id]')
    await expect(hoverEvents.first()).toBeVisible()

    const hoverId = await readHoverEventId(page)
    expect(hoverId).toBeTruthy()
    if (!hoverId) return

    await expect
      .poll(async () => await readHoverDurationMs(page, hoverId))
      .toBeGreaterThanOrEqual(1000)
    const firstHoverDurationMs = await readHoverDurationMs(page, hoverId)

    await expect
      .poll(async () => await readHoverDurationMs(page, hoverId))
      .toBeGreaterThan(firstHoverDurationMs)
    const updatedHoverDurationMs = await readHoverDurationMs(page, hoverId)

    await page.waitForTimeout(300)
    await movePointerAwayFromEntries(page)

    await expect
      .poll(async () => await readHoverDurationMs(page, hoverId))
      .toBeGreaterThan(updatedHoverDurationMs)
    const finalHoverDurationMs = await readHoverDurationMs(page, hoverId)

    expect(finalHoverDurationMs).toBeGreaterThan(firstHoverDurationMs)
  })
})
