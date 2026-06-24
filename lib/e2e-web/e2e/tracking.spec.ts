import { type Page, expect, test } from '@playwright/test'
import { CLICK_SCENARIO_IDS } from '../src/fixtures'

// --- click tracking helpers ---

interface ClickScenario {
  name: string
  entryTestId: string
  clickTargetTestId: string
}

const clickScenarios: ClickScenario[] = [
  {
    name: 'direct entry click target',
    entryTestId: `content-${CLICK_SCENARIO_IDS.direct}`,
    clickTargetTestId: `content-${CLICK_SCENARIO_IDS.direct}`,
  },
  {
    name: 'clickable descendant button',
    entryTestId: `content-${CLICK_SCENARIO_IDS.descendant}`,
    clickTargetTestId: 'entry-click-descendant-button',
  },
  {
    name: 'clickable ancestor wrapper',
    entryTestId: `content-${CLICK_SCENARIO_IDS.ancestor}`,
    clickTargetTestId: 'entry-click-ancestor-wrapper',
  },
]

async function readResolvedEntryId(page: Page, entryTestId: string): Promise<string> {
  return (await page.getByTestId(entryTestId).getAttribute('data-ctfl-entry-id')) ?? ''
}

// --- hover tracking helpers ---

interface HoverScenario {
  name: string
  hoverTargetTestId: string
}

const HOVER_ENTRY_BASELINE_ID = CLICK_SCENARIO_IDS.direct

const hoverScenarios: HoverScenario[] = [
  { name: 'entry container', hoverTargetTestId: `content-${HOVER_ENTRY_BASELINE_ID}` },
  { name: 'descendant content node', hoverTargetTestId: `entry-text-${HOVER_ENTRY_BASELINE_ID}` },
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

// --- shared beforeEach ---

async function setup(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
}

// --- tests ---

test.describe('entry click tracking', () => {
  test.beforeEach(async ({ page }) => {
    await setup(page)
  })

  test('does not emit component_click events without consent', async ({ page }) => {
    for (const scenario of clickScenarios) {
      const target = page.getByTestId(scenario.clickTargetTestId)
      await expect(target, `${scenario.name}: click target should render`).toBeVisible()
      await target.scrollIntoViewIfNeeded()
      await target.click()
    }

    await expect(page.locator('[data-testid^="event-component_click-"]')).toHaveCount(0)
  })

  test('emits component_click events for direct, descendant, and ancestor clickables after consent', async ({
    page,
  }) => {
    await page.getByTestId('consent-button').click()
    const clickEvents = page.locator('[data-testid^="event-component_click-"]')

    for (const scenario of clickScenarios) {
      const entryLocator = page.getByTestId(scenario.entryTestId)
      await expect(entryLocator, `${scenario.name}: entry should render`).toBeVisible()

      await expect
        .poll(async () => await readResolvedEntryId(page, scenario.entryTestId), {
          message: `${scenario.name}: resolved entry id should be available`,
        })
        .not.toEqual('')
      const resolvedEntryId = await readResolvedEntryId(page, scenario.entryTestId)

      const target = page.getByTestId(scenario.clickTargetTestId)
      await target.scrollIntoViewIfNeeded()
      await target.click()

      await expect(page.getByTestId(`event-component_click-${resolvedEntryId}`)).toBeVisible()
    }

    await expect.poll(async () => await clickEvents.count()).toBe(3)
  })
})

test.describe('entry hover tracking', () => {
  test.beforeEach(async ({ page }) => {
    await setup(page)
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

test.describe('flag view tracking', () => {
  test.beforeEach(async ({ page }) => {
    await setup(page)
  })

  test('does not emit flag view events without consent', async ({ page }) => {
    const flagEvents = page.locator('[data-testid="event-component-boolean"]')

    await expect(flagEvents).toHaveCount(0)

    await page.getByTestId('identify-button').click()
    await expect(page.getByTestId('reset-button')).toBeVisible()

    await expect(flagEvents).toHaveCount(0)
  })

  test('emits flag view event on consent grant for identified user — anonymous exposure must be recorded for complete experiment analysis', async ({
    page,
  }) => {
    const flagEvents = page.locator('[data-testid="event-component-boolean"]')

    await page.getByTestId('identify-button').click()
    await expect(page.getByTestId('reset-button')).toBeVisible()
    await expect(flagEvents).toHaveCount(0)

    await page.getByTestId('consent-button').click()

    await expect
      .poll(async () => await flagEvents.count(), {
        message: 'granting consent after identify should still emit a flag view event',
      })
      .toBeGreaterThan(0)
  })

  test('emits flag view event on consent for anonymous user, then again after identify — each profile change re-records exposure', async ({
    page,
  }) => {
    const flagEvents = page.locator('[data-testid="event-component-boolean"]')
    const baselineFlagEventCount = await flagEvents.count()

    await page.getByTestId('consent-button').click()

    await expect
      .poll(async () => await flagEvents.count(), {
        message: 'consented flag subscription should emit a flag view event',
      })
      .toBeGreaterThan(baselineFlagEventCount)

    const afterConsentFlagEventCount = await flagEvents.count()

    await page.getByTestId('identify-button').click()
    await expect(page.getByTestId('reset-button')).toBeVisible()

    await expect
      .poll(async () => await flagEvents.count(), {
        message: 'profile updates should emit additional flag view events',
      })
      .toBeGreaterThan(afterConsentFlagEventCount)
  })
})
