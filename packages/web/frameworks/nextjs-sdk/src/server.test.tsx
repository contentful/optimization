import {
  ServerOptimizedEntry,
  bindNextjsOptimizationRequest,
  createNextjsRequestContext,
  getNextjsServerOptimizationData,
  persistNextjsAnonymousId,
  type ContentfulOptimization,
  type CoreStatelessRequest,
  type OptimizationData,
} from './server'
import type { ServerTrackingBaselineEntry, ServerTrackingResolvedData } from './tracking-attributes'

interface CreatedSdk {
  readonly forRequest: ReturnType<typeof rs.fn>
  readonly sdk: ContentfulOptimization
}

interface SdkStub {
  readonly forRequest: ReturnType<typeof rs.fn>
  readonly resolveOptimizedEntry: (entry: unknown, selectedOptimizations: unknown) => unknown
}

interface RequestOptimizationStub {
  readonly canPersistProfile: boolean
  readonly profile: { readonly id: string } | undefined
}

const baselineEntry = createBaselineEntry()
const resolvedData = createResolvedData()
const optimizationData: OptimizationData = {
  changes: [],
  selectedOptimizations: [],
  profile: {
    id: 'new-profile-id',
    stableId: 'new-profile-id',
    random: 1,
    audiences: [],
    traits: {},
    location: {},
    session: {
      id: 'session-id',
      isReturningVisitor: false,
      landingPage: {
        path: '/',
        query: {},
        referrer: '',
        search: '',
        title: '',
        url: 'https://example.test/',
      },
      count: 1,
      activeSessionLength: 0,
      averageSessionLength: 0,
    },
  },
}

function createBaselineEntry(): ServerTrackingBaselineEntry {
  const entry = {
    sys: { id: 'baseline-entry' },
  }

  if (isServerTrackingBaselineEntry(entry)) {
    return entry
  }

  throw new Error('Expected test baseline entry to satisfy the tracking contract.')
}

function createResolvedData(): ServerTrackingResolvedData {
  const data = {
    entry: {
      sys: { id: 'variant-entry' },
    },
    selectedOptimization: {
      experienceId: 'experience-id',
      sticky: false,
      variantIndex: 1,
    },
  }

  if (isServerTrackingResolvedData(data)) {
    return data
  }

  throw new Error('Expected test resolved data to satisfy the tracking contract.')
}

function createRequestOptimizationStub(value: RequestOptimizationStub): CoreStatelessRequest {
  if (isCoreStatelessRequest(value)) {
    return value
  }

  throw new Error('Expected test request optimization to satisfy the request contract.')
}

function createSdk(
  page = rs.fn(async () => await Promise.resolve({ profile: { id: 'profile-from-api' } })),
): CreatedSdk {
  const forRequest = rs.fn((options: unknown) => ({
    canPersistProfile: true,
    page,
    profile: { id: 'profile-from-request' },
    options,
  }))

  const sdkStub: SdkStub = {
    forRequest,
    resolveOptimizedEntry: (entry, selectedOptimizations) => ({
      entry: selectedOptimizations ? resolvedData.entry : entry,
      selectedOptimization: Array.isArray(selectedOptimizations)
        ? selectedOptimizations[0]
        : undefined,
    }),
  }

  return {
    forRequest,
    sdk: createContentfulOptimizationStub(sdkStub),
  }
}

function createContentfulOptimizationStub(value: SdkStub): ContentfulOptimization {
  if (isContentfulOptimization(value)) {
    return value
  }

  throw new Error('Expected test SDK stub to satisfy ContentfulOptimization.')
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isServerTrackingBaselineEntry(value: unknown): value is ServerTrackingBaselineEntry {
  if (!isObjectRecord(value)) return false
  const { sys } = value

  return isObjectRecord(sys) && typeof sys.id === 'string'
}

function isServerTrackingResolvedData(value: unknown): value is ServerTrackingResolvedData {
  if (!isObjectRecord(value)) return false
  const { entry, selectedOptimization } = value

  return isServerTrackingBaselineEntry(entry) && isObjectRecord(selectedOptimization)
}

function isContentfulOptimization(value: SdkStub): value is SdkStub & ContentfulOptimization {
  return typeof value.forRequest === 'function' && typeof value.resolveOptimizedEntry === 'function'
}

function isCoreStatelessRequest(
  value: RequestOptimizationStub,
): value is RequestOptimizationStub & CoreStatelessRequest {
  return typeof value.canPersistProfile === 'boolean'
}

describe('Next.js server helpers', () => {
  it('builds request context from a Next-like request', () => {
    expect(
      createNextjsRequestContext({
        locale: 'en-US',
        request: {
          headers: new Headers({
            referer: 'https://example.com/from',
            'user-agent': 'test-agent',
          }),
          url: 'https://example.com/products?tab=featured',
        },
      }),
    ).toEqual({
      locale: 'en-US',
      page: {
        path: '/products',
        query: { tab: 'featured' },
        referrer: 'https://example.com/from',
        search: '?tab=featured',
        url: 'https://example.com/products?tab=featured',
      },
      userAgent: 'test-agent',
    })
  })

  it('binds Node SDK requests with anonymous profile from cookies', () => {
    const { forRequest, sdk } = createSdk()

    bindNextjsOptimizationRequest(sdk, {
      consent: { events: true, persistence: true },
      cookies: {
        get: () => ({ value: 'anonymous-id' }),
      },
      locale: 'en-US',
    })

    expect(forRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        consent: { events: true, persistence: true },
        locale: 'en-US',
        profile: { id: 'anonymous-id' },
      }),
    )
  })

  it('calls page through the request-bound Node SDK', async () => {
    const page = rs.fn(async () => await Promise.resolve({ profile: { id: 'profile-from-page' } }))
    const { sdk } = createSdk(page)

    const result = await getNextjsServerOptimizationData(sdk, {
      consent: true,
      pagePayload: { properties: { path: '/home' } },
    })

    expect(page).toHaveBeenCalledWith({ properties: { path: '/home' } })
    expect(result.data).toEqual({ profile: { id: 'profile-from-page' } })
  })

  it('persists anonymous ID when the Node request allows persistence', () => {
    const set = rs.fn()
    const requestOptimization = createRequestOptimizationStub({
      canPersistProfile: true,
      profile: undefined,
    })

    persistNextjsAnonymousId(
      {
        cookies: {
          delete: rs.fn(),
          set,
        },
      },
      requestOptimization,
      optimizationData,
    )

    expect(set).toHaveBeenCalledWith('ctfl-opt-aid', 'new-profile-id', {
      path: '/',
      sameSite: 'lax',
    })
  })

  it('renders a server wrapper with tracking attributes and caller props', () => {
    const element = ServerOptimizedEntry({
      as: 'article',
      baselineEntry,
      children: 'Rendered content',
      className: 'entry',
      resolvedData,
      trackViews: true,
    })

    expect(element.type).toBe('article')
    expect(element.props).toMatchObject({
      'data-ctfl-baseline-id': 'baseline-entry',
      'data-ctfl-entry-id': 'variant-entry',
      'data-ctfl-optimization-id': 'experience-id',
      'data-ctfl-track-views': true,
      'data-ctfl-variant-index': 1,
      children: 'Rendered content',
      className: 'entry',
    })
  })
})
