import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-core'
import { expect, test } from '@playwright/test'

const ANONYMOUS_ID = '__ctfl_opt_anonymous_id__'
const CUSTOM_PROFILE_ID = 'custom-profile-id'

test.describe('identified user with profileId', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.addCookies([
      {
        name: ANONYMOUS_ID_COOKIE,
        value: CUSTOM_PROFILE_ID,
        path: '/',
        domain: 'localhost',
      },
    ])
    await page.goto(`/user/someoneelse2`)
    await page.waitForLoadState('domcontentloaded')
  })

  test('profile id is stored in localStorage', async ({ context }) => {
    const state = await context.storageState()
    const storage = state.origins[0]?.localStorage ?? []
    const storedId = storage.find((item) => item.name === ANONYMOUS_ID)?.value

    expect(storedId).toBeDefined()
    expect(storedId).toEqual(CUSTOM_PROFILE_ID)
  })
})
