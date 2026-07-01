import { type APIRequestContext, type Page, expect, test } from '@playwright/test'

export type E2EFlag = 'CSR' | 'SSR' | 'HYDRATION' | 'SKIP_NO_JS'

const E2E_FLAGS = new Set(
  (process.env.E2E_FLAGS ?? 'CSR')
    .toUpperCase()
    .split(',')
    .map((f) => f.trim()),
)

export const isPreviewPanelEnabled = process.env.PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL === 'true'

export function hasFlag(flag: E2EFlag): boolean {
  return E2E_FLAGS.has(flag)
}

export function runIf(...flags: E2EFlag[]): void {
  test.skip(!flags.some((f) => E2E_FLAGS.has(f)), `Only runs with flag: ${flags.join(' or ')}.`)
}

export function skipIf(...flags: E2EFlag[]): void {
  test.skip(
    flags.some((f) => E2E_FLAGS.has(f)),
    `Skipped when flag present: ${flags.join(' or ')}.`,
  )
}

export function onlyWithPreviewPanel(): void {
  test.skip(!isPreviewPanelEnabled, 'Preview panel is disabled for this build.')
}

export const CONSENT_COOKIE = 'app-personalization-consent'
export const PROFILE_COOKIE = 'ctfl-opt-aid'

interface CookieContext {
  addCookies: (cookies: Array<{ name: string; value: string; url: string }>) => Promise<void>
}

export async function seedAnonymousProfile(
  context: CookieContext,
  baseURL: string | undefined,
): Promise<string> {
  if (!baseURL) throw new Error('baseURL is required')
  const profileId = crypto.randomUUID()
  await context.addCookies([
    { name: CONSENT_COOKIE, value: 'granted', url: baseURL },
    { name: PROFILE_COOKIE, value: profileId, url: baseURL },
  ])
  return profileId
}

export async function setup(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByRole('heading', { name: 'Utilities' })).toBeVisible()
}

export async function scrollThroughEntries(page: Page): Promise<void> {
  const entries = page.locator('[data-testid^="content-"]')
  const entryCount = await entries.count()

  for (let index = 0; index < entryCount; index += 1) {
    await entries.nth(index).scrollIntoViewIfNeeded()
  }
}

const MOCK_EXPERIENCE_URL = 'http://localhost:8000/experience'

export async function seedIdentifiedProfile(
  context: CookieContext,
  baseURL: string | undefined,
  request: APIRequestContext,
): Promise<void> {
  const profileId = await seedAnonymousProfile(context, baseURL)
  const now = new Date().toISOString()
  await request.post(
    `${MOCK_EXPERIENCE_URL}/v2/organizations/mock-client-id/environments/main/profiles/${profileId}`,
    {
      data: {
        events: [
          {
            channel: 'web',
            context: {
              app: { name: 'e2e-seed', version: '0.0.0' },
              campaign: {},
              gdpr: { isConsentGiven: true },
              library: { name: 'e2e-seed', version: '0.0.0' },
              locale: 'en-US',
            },
            messageId: profileId,
            originalTimestamp: now,
            sentAt: now,
            timestamp: now,
            type: 'identify',
            userId: 'charles',
            traits: { identified: true },
          },
        ],
      },
    },
  )
}
