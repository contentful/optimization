import { createProtectedFetchMethod } from './createProtectedFetchMethod'

export type FetchMethod = (url: string, init: RequestInit) => Promise<Response | undefined>

export interface BaseFetchMethodOptions {
  apiName?: string
  fetchMethod?: FetchMethod
}

export interface FetchMethodCallbackOptions {
  apiName?: string
  error?: Error
  attemptNumber?: number
  retriesLeft?: number
}

const Fetch = {
  create: createProtectedFetchMethod,
}

export default Fetch
