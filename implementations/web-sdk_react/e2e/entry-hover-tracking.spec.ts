import { type Page, expect, test } from '@playwright/test'

interface HoverScenario {
  name: string
  hoverTargetTestId: string
}

const HOVER_ENTRY_BASELINE_ID = '4ib0hsHWoSOnCVdDkizE8d'

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

function parseHoverDurationMs(label: string): number {
  const match = /Hover Duration:\s*(\d+)ms/.exec(label)
  if (!match?.[1]) return Number.NaN

  return Number.parseInt(match[1], 10)
}

function parseHoverId(testId: string | null): string | undefined {
  if (!testId) return undefined

  const prefix = 'event-component_hover-hover-'
  return testId.startsWith(prefix) ? testId.slice(prefix.length) : undefined
}

async function movePointerAwayFromEntries(page: Page): Promise<void> {
  await page.getByRole('heading', { name: 'Utilities' }).hover()
}

async function readResolvedEntryId(page: Page): Promise<string> {
  const entryId = await page
    .getByTestId(`content-${HOVER_ENTRY_BASELINE_ID}`)
    .getAttribute('data-ctfl-entry-id')

  return entryId ?? ''
}

async function readHoverDurationMs(page: Page, hoverId: string): Promise<number> {
  const label = await page.getByTestId(`event-component_hover-hover-${hoverId}`).innerText()
  return parseHoverDurationMs(label)
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

    await expect(page.locator('[data-testid^="event-component_hover-hover-"]')).toHaveCount(0)
  })

  test('emits entry hover events for entry container and descendant hovers after consent', async ({
    page,
  }) => {
    await page.getByTestId('consent-button').click()

    await expect
      .poll(async () => await readResolvedEntryId(page), {
        message: 'resolved entry id should be available',
      })
      .not.toEqual('')
    const resolvedEntryId = await readResolvedEntryId(page)

    const hoverEvents = page.locator('[data-testid^="event-component_hover-hover-"]')

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

      await expect(hoverEvents.first()).toContainText(`Entry/Flag: ${resolvedEntryId}`)
      await movePointerAwayFromEntries(page)
    }

    await expect.poll(async () => await hoverEvents.count()).toBeGreaterThanOrEqual(2)
  })

  test('updates hover duration while hovered and emits a final update when hover ends', async ({
    page,
  }) => {
    await page.getByTestId('consent-button').click()

    await expect
      .poll(async () => await readResolvedEntryId(page), {
        message: 'resolved entry id should be available',
      })
      .not.toEqual('')
    const resolvedEntryId = await readResolvedEntryId(page)

    const target = page.getByTestId(`content-${HOVER_ENTRY_BASELINE_ID}`)
    await target.scrollIntoViewIfNeeded()
    await target.hover()

    const hoverEvent = page.locator('[data-testid^="event-component_hover-hover-"]').first()
    await expect(hoverEvent).toBeVisible()
    await expect(hoverEvent).toContainText(`Entry/Flag: ${resolvedEntryId}`)

    const hoverEventTestId = await hoverEvent.getAttribute('data-testid')
    const hoverId = parseHoverId(hoverEventTestId)
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
