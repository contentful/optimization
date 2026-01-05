import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-core'
import { type Response, expect, test } from '@playwright/test'

const CLIENT_ID = process.env.VITE_NINETAILED_CLIENT_ID ?? 'error'
const ANONYMOUS_ID = '__ctfl_opt_anonymous_id__'

test.describe('identified user', () => {
  let customIdentifiedId: string
  let response: Response | null = null

  test.beforeEach(async ({ page, context }) => {
    customIdentifiedId = 'custom-profile-id'
    const cookie = {
      name: ANONYMOUS_ID_COOKIE,
      value: customIdentifiedId,
      path: '/',
      domain: 'localhost',
    }

    await context.addCookies([cookie])
    response = await page.goto(`/user/someone`)
    await page.waitForLoadState('domcontentloaded')
  })

  test('check client ID rendered from Optimization API on server-side render', async () => {
    expect(await response?.text()).toContain(`"${CLIENT_ID}"`)
  })

  test('check client ID rendered from Optimization API on client-side render', async ({ page }) => {
    await expect(page.getByTestId('clientId')).toHaveText(CLIENT_ID)
  })

  test('identifies profile id and associates it with user id', async ({ context }) => {
    const {
      origins: [origin],
    } = await context.storageState()
    expect(origin?.localStorage).toEqual([{ name: ANONYMOUS_ID, value: customIdentifiedId }])
  })
})
