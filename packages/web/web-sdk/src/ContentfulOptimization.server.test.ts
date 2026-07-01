import type { CoreConfig } from '@contentful/optimization-core'
import { batch, signals } from '@contentful/optimization-core'
import ContentfulOptimization from './ContentfulOptimization'

// Simulate a Node.js / SSR environment: no browser APIs available.
// This must appear before the module under test is imported so that
// CAN_ADD_LISTENERS resolves to false throughout the module graph.
rs.mock('./constants', () => ({
  CAN_ADD_LISTENERS: false,
  HAS_MUTATION_OBSERVER: false,
  OPTIMIZATION_WEB_SDK_NAME: 'optimization-web',
  OPTIMIZATION_WEB_SDK_VERSION: '0.0.0',
  ANONYMOUS_ID_COOKIE: '__ctfl_anon',
}))

const config: CoreConfig = {
  clientId: 'key_123',
  environment: 'main',
}

describe('ContentfulOptimization — server (CAN_ADD_LISTENERS: false)', () => {
  afterEach(() => {
    if (typeof window !== 'undefined') {
      window.contentfulOptimization?.destroy()
      delete window.contentfulOptimization
    }

    batch(() => {
      signals.consent.value = undefined
      signals.persistenceConsent.value = undefined
      signals.profile.value = undefined
      signals.selectedOptimizations.value = undefined
      signals.changes.value = undefined
    })
  })

  it('constructs without throwing when browser APIs are unavailable', () => {
    expect(() => new ContentfulOptimization(config)).not.toThrow()
  })

  it('constructs without throwing when IntersectionObserver is not defined and consent is granted — simulates Node.js / SSR', () => {
    const originalIO = (globalThis as Record<string, unknown>).IntersectionObserver
    delete (globalThis as Record<string, unknown>).IntersectionObserver

    let sdk: ContentfulOptimization | undefined

    try {
      // consent: true triggers syncAutoTrackedEntryInteractions → views.start() → new ElementViewObserver
      // which calls new IntersectionObserver — must not throw on the server
      expect(() => {
        sdk = new ContentfulOptimization({ ...config, defaults: { consent: true } })
      }).not.toThrow()
    } finally {
      sdk?.destroy()
      if (originalIO !== undefined) {
        ;(globalThis as Record<string, unknown>).IntersectionObserver = originalIO
      }
    }
  })

  it('exposes states with no browser-sourced values', () => {
    const sdk = new ContentfulOptimization(config)

    expect(sdk.states.consent.current).toBeUndefined()
    expect(sdk.states.profile.current).toBeUndefined()
    expect(sdk.states.selectedOptimizations.current).toBeUndefined()
  })

  it('destroys without throwing when browser APIs are unavailable', () => {
    const sdk = new ContentfulOptimization(config)

    expect(() => {
      sdk.destroy()
    }).not.toThrow()
  })

  it('allows a second construction after destroy — no singleton lock contention across SSR requests', () => {
    const first = new ContentfulOptimization(config)
    first.destroy()

    expect(() => new ContentfulOptimization(config)).not.toThrow()
  })

  it('allows multiple sequential construct/destroy cycles — simulates multiple SSR requests in the same process', () => {
    for (let i = 0; i < 3; i++) {
      const sdk = new ContentfulOptimization(config)
      expect(sdk.states).toBeDefined()
      expect(() => {
        sdk.destroy()
      }).not.toThrow()
    }
  })
})
