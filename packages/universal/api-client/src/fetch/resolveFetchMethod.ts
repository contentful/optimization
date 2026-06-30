import type { FetchMethod } from './Fetch'

const MISSING_FETCH_METHOD_MESSAGE = 'No fetch implementation available. Provide a fetchMethod.'

export function resolveFetchMethod(fetchMethod?: FetchMethod): FetchMethod {
  if (fetchMethod) return fetchMethod

  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch.bind(globalThis)
  }

  throw new Error(MISSING_FETCH_METHOD_MESSAGE)
}
