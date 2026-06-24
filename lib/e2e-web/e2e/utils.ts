import { type APIRequestContext, type Page, expect, test } from '@playwright/test'

export const RENDERING_MODE = (process.env.RENDERING_MODE ?? 'csr').toLowerCase()
export const isPreviewPanelEnabled = process.env.PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL === 'true'

export function isRenderingMode(...modes: string[]): boolean {
  return modes.includes(RENDERING_MODE)
}

export function onlyInModes(...modes: string[]): void {
  test.skip(!isRenderingMode(...modes), `Only runs in ${modes.join(' or ')} mode.`)
}

const MOCK_EXPERIENCE_URL = 'http://localhost:8000/experience'

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

// Seed the mock so it returns identified-visitor data for this profile ID.
// The mock tracks identified state in-memory via POSTed identify events.
export async function seedIdentifiedProfile(
  request: APIRequestContext,
  profileId: string,
): Promise<void> {
  await request.post(
    `${MOCK_EXPERIENCE_URL}/v2/organizations/mock-client-id/environments/main/profiles/${profileId}`,
    {
      data: {
        events: [
          { type: 'identify', properties: { userId: 'charles', traits: { identified: true } } },
        ],
      },
    },
  )
}
