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

function makeSsrStub(): OptimizationSdk {
  const stub: OptimizationSdk = {
    consent: noop,
    destroy: noop,
    getFlag: () => undefined,
    getMergeTagValue: () => undefined,
    hasConsent: () => false,
    identify: async (_payload) => {
      await Promise.resolve()
      return undefined
    },
    locale: undefined,
    page: async (_payload) => {
      await Promise.resolve()
      return undefined
    },
    reset: noop,
    resolveOptimizedEntry: (entry, _selectedOptimizations) => ({ entry }),
    setLocale: () => undefined,
    states: SSR_STATES,
    track: async (_payload) => {
      await Promise.resolve()
      return undefined
    },
    trackClick: async (_payload) => {
      await Promise.resolve()
    },
    trackView: async (_payload) => {
      await Promise.resolve()
      return undefined
    },
    tracking: SSR_TRACKING,
  }
  return stub
}

export const SSR_STUB: OptimizationSdk = makeSsrStub()
