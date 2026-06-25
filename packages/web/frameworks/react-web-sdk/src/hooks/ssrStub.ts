import type { Entry } from 'contentful'

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

export const SSR_STUB: OptimizationSdk = {
  consent: noop,
  destroy: noop,
  getFlag: () => undefined,
  getMergeTagValue: () => undefined,
  hasConsent: () => false,
  identify: async () => {
    await Promise.resolve()
    return undefined
  },
  locale: undefined,
  page: async () => {
    await Promise.resolve()
    return undefined
  },
  reset: noop,
  resolveOptimizedEntry: (_entry: Entry) => ({ entry: _entry }),
  setLocale: () => undefined,
  states: SSR_STATES,
  track: async () => {
    await Promise.resolve()
    return undefined
  },
  trackClick: async () => {
    await Promise.resolve()
  },
  trackView: async () => {
    await Promise.resolve()
    return undefined
  },
  tracking: SSR_TRACKING,
}
