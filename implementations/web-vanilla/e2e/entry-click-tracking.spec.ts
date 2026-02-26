import { expect, test, type Page } from '@playwright/test'

interface ClickScenario {
  name: string
  entryTestId: string
  clickTargetTestId: string
}

const clickScenarios: ClickScenario[] = [
  {
    name: 'direct entry button',
    entryTestId: 'entry-click-direct-entry',
    clickTargetTestId: 'entry-click-direct-entry',
  },
  {
    name: 'clickable descendant button',
    entryTestId: 'entry-click-descendant-entry',
    clickTargetTestId: 'entry-click-descendant-button',
  },
  {
    name: 'clickable ancestor button wrapper',
    entryTestId: 'entry-click-ancestor-entry',
    clickTargetTestId: 'entry-click-ancestor-wrapper',
  },
]

async function readResolvedEntryId(page: Page, entryTestId: string): Promise<string> {
  const entryId = await page.getByTestId(entryTestId).getAttribute('data-ctfl-entry-id')

  return entryId ?? ''
}

test.describe('entry click tracking', () => {
  test.describe('without consent', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')
    })

    test('does not emit component_click events', async ({ page }) => {
      for (const scenario of clickScenarios) {
        const target = page.getByTestId(scenario.clickTargetTestId)
        await expect(target, `${scenario.name}: click target should render`).toBeVisible()

        await target.scrollIntoViewIfNeeded()
        await target.click()
      }

      await expect(
        page.locator('#event-stream li button', {
          hasText: 'component_click',
        }),
      ).toHaveCount(0)
    })
  })

  test.describe('with consent', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')
      await page.getByRole('button', { name: 'Accept Consent' }).click()
    })

    test('emits component_click events for direct, descendant, and ancestor clickables', async ({
      page,
    }) => {
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

        await expect(
          page.getByTestId(resolvedEntryId).filter({
            hasText: 'component_click',
          }),
        ).toBeVisible()
      }

      await expect(
        page.locator('#event-stream li button', {
          hasText: 'component_click',
        }),
      ).toHaveCount(3)
    })
  })
})
