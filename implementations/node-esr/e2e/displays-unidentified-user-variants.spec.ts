import { expect, test } from '@playwright/test'

const CLIENT_ID = process.env.VITE_NINETAILED_CLIENT_ID ?? 'error'
const ANONYMOUS_ID = '__ctfl_opt_anonymous_id__'
const UID_LENGTH = 36

test.describe('unidentified user', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // await page.waitForLoadState('domcontentloaded')
  })

  test('BACKEND: check client ID rendered from Optimization API on server-side render', async ({
    request,
  }) => {
    const response = await request.get('/')

    expect(await response.text()).toContain(`"clientId":"${CLIENT_ID}"`)
  })

  test('BACKEND: generates new Profile id', async ({ context, page }) => {
    await page.goto('/')

    const state = await context.storageState()

    const storage = state.origins[0]?.localStorage ?? []
    const storedId = storage.find((item) => item.name === ANONYMOUS_ID)?.value

    expect(storedId).toBeDefined()
    expect(storedId).toHaveLength(UID_LENGTH)
  })


  test('FRONTEND: check client ID rendered from Optimization API on client-side render', async ({
    page,
  }) => {
    await page.goto('/')

    await expect(page.getByTestId('clientId')).toHaveText(CLIENT_ID)
  })
})
