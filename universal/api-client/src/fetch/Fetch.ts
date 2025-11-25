import { createProtectedFetchMethod } from './createProtectedFetchMethod'

/**
 * Signature of a fetch method used by the API clients.
 *
 * @param url - The request URL.
 * @param init - Initialization options passed to `fetch`.
 * @returns A promise that resolves with the {@link Response}.
 *
 * @public
 *
 * @remarks
 * This abstraction allows the underlying implementation to be replaced,
 * for example in tests or different runtime environments.
 *
 * @example
 * ```ts
 * const method: FetchMethod = async (url, init) => {
 *   return fetch(url, init)
 * }
 * ```
 */
export type FetchMethod = (url: string | URL, init: RequestInit) => Promise<Response>

/**
 * Base options shared across fetch method factories.
 *
 * @public
 */
export interface BaseFetchMethodOptions {
  /**
   * Human-readable name of the API being called.
   *
   * @remarks
   * Used primarily for logging and error messages.
   */
  apiName?: string

  /**
   * Custom fetch implementation to use instead of the global `fetch`.
   *
   * @remarks
   * This is useful for providing polyfills, mocks, or instrumented fetch
   * implementations.
   */
  fetchMethod?: FetchMethod
}

/**
 * Options passed to callback functions invoked by fetch wrappers.
 *
 * @public
 *
 * @remarks
 * Not all fields are guaranteed to be present in all callback scenarios.
 */
export interface FetchMethodCallbackOptions {
  /**
   * Name of the API associated with the request.
   */
  apiName?: string

  /**
   * Error that caused the callback to be invoked, if available.
   */
  error?: Error

  /**
   * The current attempt number (for retry callbacks).
   */
  attemptNumber?: number

  /**
   * Number of retry attempts remaining (for retry callbacks).
   */
  retriesLeft?: number
}

/**
 * Namespace-like object providing factory methods for protected fetch functions.
 *
 * @public
 */
const Fetch = {
  /**
   * Creates a fully protected fetch method with timeout and retry behavior.
   *
   * @example
   * ```ts
   * const fetchMethod = Fetch.create({
   *   apiName: 'Optimization',
   *   requestTimeout: 3000,
   *   retries: 2,
   * })
   *
   * const response = await fetchMethod('https://example.com', { method: 'GET' })
   * ```
   *
   * @see createProtectedFetchMethod
   */
  create: createProtectedFetchMethod,
}

export default Fetch
