import type ContentfulOptimization from '@contentful/optimization-web'
import { expect, test } from '@playwright/test'

interface OptimizationWindow {
  navigator: { onLine: boolean }
  contentfulOptimization: ContentfulOptimization
  flushCompletions?: number
  pendingFlushes?: Promise<void>
}

declare const window: OptimizationWindow

test.beforeEach(async ({ context, page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Accept Consent' }).click()
  await expect(page.getByRole('button', { name: 'Reject Consent' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.evaluate(async () => {
    await window.contentfulOptimization.flush()
  })
  await context.setOffline(true)
  await expect.poll(async () => await page.evaluate(() => window.navigator.onLine)).toBe(false)
})

test('refuses incoming offline events at the default capacity', async ({ page }) => {
  const results = await page.evaluate(async () => {
    const { contentfulOptimization: sdk } = window
    const accepted: boolean[] = []
    for (let index = 0; index < 101; index += 1) {
      accepted.push((await sdk.track({ event: `offline-capacity-${index}` })).accepted)
    }
    return accepted
  })
  expect(results).toEqual([...Array.from({ length: 100 }, () => true), false])
})

test('preserves offline event order and joins the active public flush', async ({
  context,
  page,
}) => {
  const events = ['offline-first', 'offline-second']
  expect(
    await page.evaluate(async (names) => {
      const accepted: boolean[] = []
      for (const event of names) {
        accepted.push((await window.contentfulOptimization.track({ event })).accepted)
      }
      return accepted
    }, events),
  ).toEqual([true, true])

  let release = (): void => undefined
  const responseGate = new Promise<void>((resolve) => {
    release = resolve
  })
  const requests: string[][] = []
  await page.route('**/experience/**', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }
    const payload: unknown = route.request().postDataJSON()
    if (typeof payload !== 'object' || payload === null || !('events' in payload)) {
      throw new Error('Expected an Experience request containing events.')
    }
    if (!Array.isArray(payload.events)) throw new Error('Expected an events array.')
    const names: string[] = []
    for (const event of payload.events) {
      if (
        typeof event === 'object' &&
        event !== null &&
        'event' in event &&
        typeof event.event === 'string'
      ) {
        names.push(event.event)
      }
    }
    requests.push(names)
    await responseGate
    await route.continue()
  })

  try {
    await context.setOffline(false)
    await expect.poll(() => requests.length).toBe(1)
    await page.evaluate(() => {
      const target = window
      target.flushCompletions = 0
      target.pendingFlushes = Promise.all(
        [target.contentfulOptimization.flush(), target.contentfulOptimization.flush()].map(
          async (attempt) => {
            await attempt
            target.flushCompletions = (target.flushCompletions ?? 0) + 1
          },
        ),
      ).then(() => undefined)
    })
    expect(await page.evaluate(() => window.flushCompletions)).toBe(0)
    expect(requests).toEqual([events])
    release()
    await page.evaluate(async () => {
      await window.pendingFlushes
    })
    expect(await page.evaluate(() => window.flushCompletions)).toBe(2)
    expect(requests).toHaveLength(1)
  } finally {
    release()
    await context.setOffline(false)
  }
})
