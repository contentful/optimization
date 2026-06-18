import { type Locator, type Page, expect, test } from '@playwright/test'

type EntryObservationScope = 'auto' | 'manual'

const ENTRY_SCOPE_SELECTOR_BY_SCOPE: Record<EntryObservationScope, string> = {
  auto: '#auto-observed',
  manual: '#manually-observed',
}

function resolveEntryLocator(page: Page, scope: EntryObservationScope): Locator {
  return page.locator(
    `${ENTRY_SCOPE_SELECTOR_BY_SCOPE[scope]} [data-testid^="content-"]:not([data-testid^="content-entry-"])`,
  )
}

function resolveEntryViewEvent(page: Page, entryId: string): Locator {
  return page.locator('[data-testid^="event-view-"]').filter({
    hasText: `Entry/Flag: ${entryId}`,
  })
}

async function waitForResolvedEntryWrappers(page: Page): Promise<void> {
  await expect
    .poll(async () => await page.locator('[data-ctfl-entry-id]').count(), {
      message: 'resolved entry wrappers should be available',
    })
    .toBeGreaterThan(0)
  await expect(page.locator('[data-ctfl-loading-layout-target="true"]')).toHaveCount(0)
}

async function readResolvedEntryId(page: Page, entryTestId: string): Promise<string> {
  const entryMetadata = page
    .getByTestId(entryTestId)
    .locator('xpath=ancestor::*[@data-ctfl-entry-id][1]')
  const entryId = await entryMetadata
    .getAttribute('data-ctfl-entry-id', { timeout: 500 })
    .catch(() => undefined)

  return entryId ?? ''
}

async function resolveEntryTestIds(page: Page, scope: EntryObservationScope): Promise<string[]> {
  await waitForResolvedEntryWrappers(page)

  const entries = resolveEntryLocator(page, scope)
  const entryCount = await entries.count()
  const entryTestIds: string[] = []

  for (let index = 0; index < entryCount; index += 1) {
    const entryTestId = await entries.nth(index).getAttribute('data-testid')

    if (entryTestId) {
      entryTestIds.push(entryTestId)
    }
  }

  return entryTestIds
}

async function scrollThroughEntries(page: Page, scope: EntryObservationScope): Promise<string[]> {
  const entryTestIds = await resolveEntryTestIds(page, scope)
  const resolvedEntryIds: string[] = []

  for (const entryTestId of entryTestIds) {
    const resolvedEntryId = await readResolvedEntryId(page, entryTestId)
    if (resolvedEntryId) {
      resolvedEntryIds.push(resolvedEntryId)
    }

    await page.getByTestId(entryTestId).scrollIntoViewIfNeeded()
  }

  return resolvedEntryIds
}

test.describe('consent gating', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
  })

  test('allows page events without consent but gates automatic and manual entry view events', async ({
    page,
  }) => {
    const pageEvents = page.locator('[data-testid^="event-page-"]')
    const viewEvents = page.locator('[data-testid^="event-view-"]')

    await expect(pageEvents.first()).toBeVisible()

    await scrollThroughEntries(page, 'auto')
    await scrollThroughEntries(page, 'manual')
    await expect(viewEvents).toHaveCount(0)
  })

  test('emits automatic entry view events after consent is accepted', async ({ page }) => {
    const pageEvents = page.locator('[data-testid^="event-page-"]')

    await expect(pageEvents.first()).toBeVisible()

    await page.getByRole('button', { name: 'Accept Consent' }).click()
    await expect(page.getByTestId('consent-status')).toHaveText('Consent: true')
    const resolvedEntryIds = await scrollThroughEntries(page, 'auto')

    for (const resolvedEntryId of resolvedEntryIds) {
      await expect(
        resolveEntryViewEvent(page, resolvedEntryId),
        `automatic view event should render for "${resolvedEntryId}"`,
      ).toBeVisible()
    }
  })

  test('emits manual entry view events after consent is accepted', async ({ page }) => {
    const pageEvents = page.locator('[data-testid^="event-page-"]')

    await expect(pageEvents.first()).toBeVisible()

    await page.getByRole('button', { name: 'Accept Consent' }).click()
    await expect(page.getByTestId('consent-status')).toHaveText('Consent: true')
    const resolvedEntryIds = await scrollThroughEntries(page, 'manual')

    for (const resolvedEntryId of resolvedEntryIds) {
      await expect(
        resolveEntryViewEvent(page, resolvedEntryId),
        `manual view event should render for "${resolvedEntryId}"`,
      ).toBeVisible()
    }
  })
})
