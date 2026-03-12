import { expect, test, type Locator, type Page } from '@playwright/test'

interface HoverScenario {
  name: string
  entryTestId: string
  hoverTargetTestId: string
}

const hoverScenarios: HoverScenario[] = [
  {
    name: 'direct entry button',
    entryTestId: 'entry-click-direct-entry',
    hoverTargetTestId: 'entry-click-direct-entry',
  },
  {
    name: 'hoverable descendant button',
    entryTestId: 'entry-click-descendant-entry',
    hoverTargetTestId: 'entry-click-descendant-button',
  },
  {
    name: 'inline entry nested in clickable ancestor',
    entryTestId: 'entry-click-ancestor-entry',
    hoverTargetTestId: 'entry-click-ancestor-entry',
  },
]

async function movePointerAwayFromEntries(page: Page): Promise<void> {
  await page.locator('#utility-panel').hover()
}

async function readHoverDurationMs(button: Locator): Promise<number> {
  const hoverDurationMs = await button.getAttribute('data-hover-duration-ms')
  if (!hoverDurationMs) return Number.NaN

  return Number.parseInt(hoverDurationMs, 10)
}

function getHoverButtons(page: Page): Locator {
  return page
    .locator('#event-stream li button[data-hover-id]')
    .filter({ hasText: 'component_hover' })
}

test.describe('entry hover tracking', () => {
  test.describe('without consent', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')
    })

    test('does not emit component_hover events', async ({ page }) => {
      for (const scenario of hoverScenarios) {
        const target = page.getByTestId(scenario.hoverTargetTestId)
        await expect(target, `${scenario.name}: hover target should render`).toBeVisible()

        await target.scrollIntoViewIfNeeded()
        await target.hover()
        await page.waitForTimeout(1200)
        await movePointerAwayFromEntries(page)
      }

      await expect(
        page.locator('#event-stream li button', {
          hasText: 'component_hover',
        }),
      ).toHaveCount(0)
    })
  })

  test.describe('with consent', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')
      await page.getByRole('button', { name: 'Accept Consent' }).click()
      await expect(page.getByRole('button', { name: 'Reject Consent' })).toBeVisible()
    })

    test('emits component_hover events for direct, descendant, and inline targets', async ({
      page,
    }) => {
      const hoverButtons = getHoverButtons(page)

      for (const scenario of hoverScenarios) {
        const entryLocator = page.getByTestId(scenario.entryTestId)
        await expect(entryLocator, `${scenario.name}: entry should render`).toBeVisible()

        const target = page.getByTestId(scenario.hoverTargetTestId)
        const baselineHoverEventCount = await hoverButtons.count()

        await target.scrollIntoViewIfNeeded()
        await target.hover()

        await expect
          .poll(async () => await hoverButtons.count(), {
            message: `${scenario.name}: hover event count should increase`,
          })
          .toBeGreaterThan(baselineHoverEventCount)

        await expect(hoverButtons.last()).toHaveAttribute('data-hover-id', /.+/)

        await movePointerAwayFromEntries(page)
      }

      await expect.poll(async () => await hoverButtons.count()).toBeGreaterThanOrEqual(3)
    })

    test('updates hover duration while hovered and emits a final update after hover ends', async ({
      page,
    }) => {
      const scenario = hoverScenarios[0]
      if (!scenario) return

      const target = page.getByTestId(scenario.hoverTargetTestId)
      const hoverButtons = getHoverButtons(page)
      const baselineHoverEventCount = await hoverButtons.count()
      await target.scrollIntoViewIfNeeded()
      await target.hover()

      await expect
        .poll(async () => await hoverButtons.count(), {
          message: `${scenario.name}: initial hover event should be emitted`,
        })
        .toBeGreaterThan(baselineHoverEventCount)

      const hoverSessionButton = hoverButtons.last()

      await expect(hoverSessionButton).toBeVisible()

      const hoverId = await hoverSessionButton.getAttribute('data-hover-id')
      expect(hoverId).toBeTruthy()

      await expect
        .poll(async () => await readHoverDurationMs(hoverSessionButton))
        .toBeGreaterThanOrEqual(1000)
      const firstHoverDurationMs = await readHoverDurationMs(hoverSessionButton)

      await expect
        .poll(async () => await readHoverDurationMs(hoverSessionButton))
        .toBeGreaterThan(firstHoverDurationMs)
      const updatedHoverDurationMs = await readHoverDurationMs(hoverSessionButton)

      const updatedHoverId = await hoverSessionButton.getAttribute('data-hover-id')
      expect(updatedHoverId).toEqual(hoverId)

      await page.waitForTimeout(300)
      await movePointerAwayFromEntries(page)

      await expect
        .poll(async () => await readHoverDurationMs(hoverSessionButton))
        .toBeGreaterThan(updatedHoverDurationMs)
      const finalHoverDurationMs = await readHoverDurationMs(hoverSessionButton)

      const finalHoverId = await hoverSessionButton.getAttribute('data-hover-id')
      expect(finalHoverId).toEqual(hoverId)
      expect(finalHoverDurationMs).toBeGreaterThan(firstHoverDurationMs)
    })
  })
})
