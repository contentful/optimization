import { type Page, expect, test } from '@playwright/test'
import { CLICK_SCENARIO_IDS } from '../src/fixtures'

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
  const entryId = await page.getByTestId(entryTestId).getAttribute('data-ctfl-entry-id')

  return entryId ?? ''
}

test.describe('entry click tracking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
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
