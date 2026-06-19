import type { EventEmissionResult } from '@contentful/optimization-core/sdk-support'
import { beforeEach, describe, expect, it, rs } from '@rstest/core'
import {
  CurrentPageTracker,
  getCurrentPageTracker,
  installCurrentPageTrackerSdkSupport,
  resetCurrentPageTrackerState,
} from './currentPageTracker'

function createSdk({
  hasConsent = () => true,
  pageWithEmissionResult,
}: {
  hasConsent?: (name: string) => boolean
  pageWithEmissionResult: (payload: unknown) => Promise<EventEmissionResult>
}): { hasConsent: (name: string) => boolean } {
  const sdk = { hasConsent }

  installCurrentPageTrackerSdkSupport(sdk, {
    pageWithEmissionResult,
  })

  return sdk
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolvePromise: (value: T) => void = () => undefined
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })

  return { promise, resolve: resolvePromise }
}

describe('CurrentPageTracker', () => {
  beforeEach(() => {
    resetCurrentPageTrackerState()
  })

  it('emits the first allowed page and dedupes the accepted route key', async () => {
    const pageWithEmissionResult = rs.fn().mockResolvedValue({ accepted: true })
    const sdk = createSdk({ pageWithEmissionResult })
    const tracker = new CurrentPageTracker()

    await tracker.emitIfNeeded(sdk, {
      routeKey: '/home',
      buildPayload: ({ isInitialEmission }) => ({ properties: { isInitialEmission } }),
    })
    await tracker.emitIfNeeded(sdk, {
      routeKey: '/home',
      buildPayload: ({ isInitialEmission }) => ({ properties: { isInitialEmission } }),
    })

    expect(pageWithEmissionResult).toHaveBeenCalledTimes(1)
    expect(pageWithEmissionResult).toHaveBeenCalledWith({
      properties: { isInitialEmission: true },
    })
  })

  it('retries the current route after tracking becomes allowed', async () => {
    let isAllowed = false
    const pageWithEmissionResult = rs.fn().mockResolvedValue({ accepted: true })
    const sdk = createSdk({
      hasConsent: () => isAllowed,
      pageWithEmissionResult,
    })
    const tracker = new CurrentPageTracker()

    await tracker.emitIfNeeded(sdk, {
      routeKey: '/blocked',
      buildPayload: () => ({}),
    })
    isAllowed = true
    await tracker.emitIfNeeded(sdk, {
      routeKey: '/blocked',
      buildPayload: () => ({}),
    })

    expect(pageWithEmissionResult).toHaveBeenCalledTimes(1)
  })

  it('does not duplicate the same route while in flight', async () => {
    const first = deferred<{ accepted: boolean }>()
    const pageWithEmissionResult = rs.fn().mockReturnValueOnce(first.promise)
    const sdk = createSdk({ pageWithEmissionResult })
    const tracker = new CurrentPageTracker()

    const firstEmission = tracker.emitIfNeeded(sdk, {
      routeKey: '/slow',
      buildPayload: () => ({}),
    })
    await tracker.emitIfNeeded(sdk, {
      routeKey: '/slow',
      buildPayload: () => ({}),
    })
    first.resolve({ accepted: true })
    await firstEmission

    expect(pageWithEmissionResult).toHaveBeenCalledTimes(1)
  })

  it('emits changed routes and updates initial emission metadata after acceptance', async () => {
    const pageWithEmissionResult = rs.fn().mockResolvedValue({ accepted: true })
    const sdk = createSdk({ pageWithEmissionResult })
    const tracker = new CurrentPageTracker()

    await tracker.emitIfNeeded(sdk, {
      routeKey: '/first',
      buildPayload: ({ isInitialEmission }) => ({ properties: { isInitialEmission } }),
    })
    await tracker.emitIfNeeded(sdk, {
      routeKey: '/second',
      buildPayload: ({ isInitialEmission }) => ({ properties: { isInitialEmission } }),
    })

    expect(pageWithEmissionResult).toHaveBeenNthCalledWith(1, {
      properties: { isInitialEmission: true },
    })
    expect(pageWithEmissionResult).toHaveBeenNthCalledWith(2, {
      properties: { isInitialEmission: false },
    })
  })

  it('cleans up rejected emissions so the route can retry', async () => {
    const pageWithEmissionResult = rs
      .fn()
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValueOnce({ accepted: true })
    const sdk = createSdk({ pageWithEmissionResult })
    const tracker = new CurrentPageTracker()

    await tracker
      .emitIfNeeded(sdk, {
        routeKey: '/retry',
        buildPayload: () => ({}),
      })
      .catch(() => undefined)
    await tracker.emitIfNeeded(sdk, {
      routeKey: '/retry',
      buildPayload: () => ({}),
    })

    expect(pageWithEmissionResult).toHaveBeenCalledTimes(2)
  })

  it('returns the current tracker instance for an SDK', () => {
    const sdk = createSdk({ pageWithEmissionResult: rs.fn() })

    expect(getCurrentPageTracker(sdk)).toBe(getCurrentPageTracker(sdk))
  })

  it('tracks current route state independently per SDK', async () => {
    const pageWithEmissionResult = rs.fn().mockResolvedValue({ accepted: true })
    const firstSdk = createSdk({ pageWithEmissionResult })
    const secondSdk = createSdk({ pageWithEmissionResult })

    await getCurrentPageTracker(firstSdk).emitIfNeeded(firstSdk, {
      routeKey: '/home',
      buildPayload: () => ({}),
    })
    await getCurrentPageTracker(secondSdk).emitIfNeeded(secondSdk, {
      routeKey: '/home',
      buildPayload: () => ({}),
    })

    expect(pageWithEmissionResult).toHaveBeenCalledTimes(2)
  })
})
