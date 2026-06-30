import ContentfulOptimization from '@contentful/optimization-web'
import type { EventEmissionResult, ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'

import type { OptimizationSdk } from '../context/OptimizationContext'

function noop(): void {
  // intentional no-op
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

const NOT_ACCEPTED: EventEmissionResult = { accepted: false }

function makeSsrStub(): OptimizationSdk {
  const stub = {
    consent: noop,
    destroy: noop,
    getFlag: () => undefined,
    getMergeTagValue: () => undefined,
    hasConsent: () => false,
    identify: async () => {
      await Promise.resolve()
      return NOT_ACCEPTED
    },
    locale: undefined,
    page: async () => {
      await Promise.resolve()
      return NOT_ACCEPTED
    },
    reset: noop,
    resolveOptimizedEntry: (_entry: Entry): ResolvedData<EntrySkeletonType> => ({
      entry: _entry,
    }),
    setLocale: () => undefined,
    states: SSR_STATES,
    track: async () => {
      await Promise.resolve()
      return NOT_ACCEPTED
    },
    trackClick: async () => {
      await Promise.resolve()
    },
    trackView: async () => {
      await Promise.resolve()
      return NOT_ACCEPTED
    },
    tracking: SSR_TRACKING,
  }

  Object.setPrototypeOf(stub, ContentfulOptimization.prototype)

  if (!(stub instanceof ContentfulOptimization)) {
    throw new Error('Expected SSR stub to use the ContentfulOptimization prototype.')
  }

  return stub
}

export const SSR_STUB: OptimizationSdk = makeSsrStub()
