import { type Response, expect, test } from '@playwright/test'

const CLIENT_ID = process.env.VITE_NINETAILED_CLIENT_ID ?? 'error'
const ANONYMOUS_ID = '__ctfl_opt_anonymous_id__'
const UID_LENGTH = 36

test.describe('unidentified user', () => {
  let response: Response | null = null

  test.beforeEach(async ({ page }) => {
    response = await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
  })

  test('check client ID rendered from Optimization API on server-side render', async () => {
    expect(await response?.text()).toContain(`"clientId":"${CLIENT_ID}"`)
  })

  test('check client ID rendered from Optimization API on client-side render', async ({ page }) => {
    await expect(page.getByTestId('clientId')).toHaveText(CLIENT_ID)
  })


  test('generates new Profile id', async ({ context, page }) => {
    await page.goto('/')

    const state = await context.storageState()

    const storage = state.origins[0]?.localStorage ?? []
    const storedId = storage.find((item) => item.name === ANONYMOUS_ID)?.value

    expect(storedId).toBeDefined()
    expect(storedId).toHaveLength(UID_LENGTH)
  })
})
