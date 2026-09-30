import { expect, test } from '@playwright/test'
import { getAnonymousIdFromCookie, getAnonymousIdFromStorage } from './utils'

const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readEventTypes(payload: unknown): string[] {
  if (!isRecord(payload)) return []
  const events = payload.events
  if (!Array.isArray(events)) return []

  return events.flatMap((event) =>
    isRecord(event) && typeof event.type === 'string' ? [event.type] : [],
  )
}

test.describe('unidentified user', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
  })

  test('does not store profile continuity before app consent', async ({ context }) => {
    await expect.poll(async () => await getAnonymousIdFromCookie(context)).toBeUndefined()
    await expect.poll(async () => await getAnonymousIdFromStorage(context)).toBeUndefined()
  })

  test('displays common baselines before app consent', async ({ page }) => {
    await expect(
      page.getByText('This is a baseline content entry for visitors from any continent.'),
    ).toBeVisible()

    await expect(
      page.getByText('This is a baseline content entry for all visitors using any device.'),
    ).toBeVisible()
  })

  test('displays unidentified user baselines before app consent', async ({ page }) => {
    await expect(page.getByText('This is a level 0 nested baseline entry.')).toBeVisible()

    await expect(page.getByText('This is a level 1 nested baseline entry.')).toBeVisible()

    await expect(page.getByText('This is a level 2 nested baseline entry.')).toBeVisible()

    await expect(page.getByText('This is a baseline content entry for all users.')).toBeVisible()

    await expect(
      page.getByText('This is a baseline content entry for an A/B/C experiment: A'),
    ).toBeVisible()

    await expect(
      page.getByText(
        'This is a baseline content entry for all visitors with or without a custom event.',
      ),
    ).toBeVisible()

    await expect(
      page.getByText('This is a baseline content entry for all identified or unidentified users.'),
    ).toBeVisible()
  })

  test('commits the track preview replay once without preflight', async ({ context, page }) => {
    const commits: Array<{ readonly eventTypes: string[]; readonly url: string }> = []
    await context.addCookies([
      {
        name: APP_PERSONALIZATION_CONSENT_COOKIE,
        value: 'granted',
        domain: 'localhost',
        path: '/',
        sameSite: 'Lax',
      },
    ])
    await page.route('**/experience/**', async (route) => {
      commits.push({
        eventTypes: readEventTypes(route.request().postDataJSON()),
        url: route.request().url(),
      })
      await route.continue()
    })

    await page.goto('/track')
    await expect
      .poll(() => commits)
      .toEqual([{ eventTypes: ['track', 'page'], url: expect.any(String) }])
    expect(commits[0]?.url).not.toContain('type=preflight')
  })
})
