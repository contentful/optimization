export { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-core'

export const CAN_ADD_LISTENERS =
  typeof window !== 'undefined' &&
  typeof document !== 'undefined' &&
  typeof document.addEventListener === 'function'
