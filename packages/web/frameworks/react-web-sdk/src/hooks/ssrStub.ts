import type { OptimizationSdk } from '../context/OptimizationContext'

function noop(): void {
  // intentional no-op for SSR stub subscriptions
}

interface StubSubscription {
  unsubscribe: () => void
}

interface StubObservable<T> {
  readonly current: T
  subscribe: (next: (v: T) => void) => StubSubscription
  subscribeOnce: (next: (v: NonNullable<T>) => void) => StubSubscription
}

function ssrObs<T>(current: T): StubObservable<T> {
  return {
    current,
    subscribe: () => ({ unsubscribe: noop }),
    subscribeOnce: () => ({ unsubscribe: noop }),
  }
}

const SSR_STATES: OptimizationSdk['states'] = {
  blockedEventStream: ssrObs(undefined),
  canOptimize: ssrObs(false),
  consent: ssrObs(undefined),
  eventStream: ssrObs(undefined),
  experienceRequestState: ssrObs({ status: 'idle' as const }),
  flag: () => ssrObs(undefined),
  locale: ssrObs(undefined),
  optimizationPossible: ssrObs(false),
  persistenceConsent: ssrObs(undefined),
  previewPanelAttached: ssrObs(false),
  previewPanelOpen: ssrObs(false),
  profile: ssrObs(undefined),
  selectedOptimizations: ssrObs(undefined),
}

const SSR_TRACKING: OptimizationSdk['tracking'] = {
  clearElement: noop,
  disable: noop,
  disableElement: noop,
  enable: noop,
  enableElement: noop,
}

async function ssrIdentify(_: Parameters<OptimizationSdk['identify']>[0]): Promise<undefined> {
  await Promise.resolve()
  return undefined
}

async function ssrPage(_: Parameters<OptimizationSdk['page']>[0]): Promise<undefined> {
  await Promise.resolve()
  return undefined
}

async function ssrTrack(_: Parameters<OptimizationSdk['track']>[0]): Promise<undefined> {
  await Promise.resolve()
  return undefined
}

async function ssrTrackClick(_: Parameters<OptimizationSdk['trackClick']>[0]): Promise<undefined> {
  await Promise.resolve()
}

async function ssrTrackView(_: Parameters<OptimizationSdk['trackView']>[0]): Promise<undefined> {
  await Promise.resolve()
  return undefined
}

export const SSR_STUB: OptimizationSdk = {
  consent: noop,
  destroy: noop,
  getFlag: () => undefined,
  getMergeTagValue: () => undefined,
  hasConsent: () => false,
  identify: ssrIdentify,
  locale: undefined,
  page: ssrPage,
  reset: noop,
  resolveOptimizedEntry: (entry) => ({ entry }),
  setLocale: () => undefined,
  states: SSR_STATES,
  track: ssrTrack,
  trackClick: ssrTrackClick,
  trackView: ssrTrackView,
  tracking: SSR_TRACKING,
}
