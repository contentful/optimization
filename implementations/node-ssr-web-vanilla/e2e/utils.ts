import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-core'
import type { BrowserContext } from '@playwright/test'

export const ANONYMOUS_ID = '__ctfl_opt_anonymous_id__'

export async function getAnonymousIdFromCookie(
  context: BrowserContext,
): Promise<string | undefined> {
  const cookies = await context.cookies()
  return cookies.find((cookie) => cookie.name === ANONYMOUS_ID_COOKIE)?.value
}

export async function getAnonymousIdFromStorage(
  context: BrowserContext,
): Promise<string | undefined> {
  const state = await context.storageState()
  const storage = state.origins[0]?.localStorage ?? []
  return storage.find((item) => item.name === ANONYMOUS_ID)?.value
}
