import {
  NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER,
  bindNextjsOptimizationRequest,
  createNextjsOptimization,
  createNextjsPageContext,
  createNextjsRequestContext,
  getNextjsServerOptimizationData,
  persistNextjsAnonymousId,
  type ContentfulOptimization,
  type CoreStatelessRequest,
  type OptimizationData,
} from './server'

const sdkConfig = {
  clientId: 'test-client-id',
  environment: 'main',
}

interface CreatedSdk {
  readonly forRequest: ReturnType<typeof rs.fn<ContentfulOptimization['forRequest']>>
  readonly sdk: ContentfulOptimization
}

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

function createSdk(
  page = rs.fn<CoreStatelessRequest['page']>(
    async () =>
      await Promise.resolve({
        accepted: true,
        data: {
          ...optimizationData,
          profile: { ...optimizationData.profile, id: 'profile-from-api' },
        },
      }),
  ),
): CreatedSdk {
  const sdk = createNextjsOptimization(sdkConfig)
  const requestOptimization = sdk.forRequest({ consent: true })
  const forRequest = rs
    .fn<ContentfulOptimization['forRequest']>()
    .mockReturnValue(requestOptimization)

  rs.spyOn(sdk, 'forRequest').mockImplementation(forRequest)
  rs.spyOn(requestOptimization, 'page').mockImplementation(page)

  return {
    forRequest,
    sdk,
  }
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

  it('builds request context from forwarded proxy URL headers', () => {
    expect(
      createNextjsRequestContext({
        headers: new Headers({
          [NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER]: 'https://example.com/products?tab=featured',
          referer: 'https://example.com/from',
          'user-agent': 'test-agent',
        }),
        locale: 'en-US',
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

  it('lets event context user agent override request headers', () => {
    expect(
      createNextjsRequestContext({
        eventContext: {
          userAgent: 'context-agent',
        },
        headers: new Headers({
          'user-agent': 'header-agent',
        }),
      }).userAgent,
    ).toBe('context-agent')
  })

  it('merges explicit headers over request headers', () => {
    const context = createNextjsRequestContext({
      headers: new Headers({
        'user-agent': 'explicit-agent',
      }),
      request: {
        headers: new Headers({
          referer: 'https://example.com/from-request',
          'user-agent': 'request-agent',
        }),
        url: 'https://example.com/products?tab=featured',
      },
    })

    expect(context.userAgent).toBe('explicit-agent')
    expect(context.page).toEqual({
      path: '/products',
      query: { tab: 'featured' },
      referrer: 'https://example.com/from-request',
      search: '?tab=featured',
      url: 'https://example.com/products?tab=featured',
    })
  })

  it('lets explicit top-level page options override forwarded URL context', () => {
    expect(
      createNextjsRequestContext({
        headers: new Headers({
          [NEXTJS_OPTIMIZATION_REQUEST_URL_HEADER]: 'https://example.com/products?tab=featured',
        }),
        page: {
          path: '/manual',
          searchParams: { audience: 'vip' },
        },
      }).page,
    ).toEqual({
      path: '/manual',
      query: { audience: 'vip' },
      referrer: '',
      search: '?audience=vip',
      url: '/manual?audience=vip',
    })
  })

  it('lets explicit top-level page options override event context page', () => {
    expect(
      createNextjsRequestContext({
        eventContext: {
          page: {
            path: '/context',
            query: { audience: 'context' },
            referrer: 'https://example.com/from-context',
            search: '?audience=context',
            url: 'https://example.com/context?audience=context',
          },
        },
        page: {
          path: '/manual',
          searchParams: { audience: 'vip' },
        },
      }).page,
    ).toEqual({
      path: '/manual',
      query: { audience: 'vip' },
      referrer: '',
      search: '?audience=vip',
      url: '/manual?audience=vip',
    })
  })

  it('builds page context from App Router path and searchParams', () => {
    expect(
      createNextjsPageContext({
        origin: 'https://example.com',
        path: '/products',
        referrer: 'https://example.com/from',
        searchParams: {
          empty: '',
          ignored: undefined,
          tab: 'featured',
          tag: ['sale', 'new'],
        },
      }),
    ).toEqual({
      path: '/products',
      query: {
        empty: '',
        tab: 'featured',
        tag: 'new',
      },
      referrer: 'https://example.com/from',
      search: '?empty=&tab=featured&tag=sale&tag=new',
      url: 'https://example.com/products?empty=&tab=featured&tag=sale&tag=new',
    })
  })

  it('normalizes URLSearchParams query values with the last duplicate value', () => {
    expect(
      createNextjsPageContext({
        path: '/products',
        searchParams: new URLSearchParams('tab=first&tab=second'),
      }),
    ).toEqual({
      path: '/products',
      query: { tab: 'second' },
      referrer: '',
      search: '?tab=first&tab=second',
      url: '/products?tab=first&tab=second',
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

  it('prefers top-level anonymous ID cookies over request cookies', () => {
    const { forRequest, sdk } = createSdk()

    bindNextjsOptimizationRequest(sdk, {
      consent: { events: true, persistence: true },
      cookies: {
        get: () => ({ value: 'top-level-anonymous-id' }),
      },
      request: {
        cookies: {
          get: () => ({ value: 'request-anonymous-id' }),
        },
        headers: new Headers(),
        url: 'https://example.com/',
      },
    })

    expect(forRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: { id: 'top-level-anonymous-id' },
      }),
    )
  })

  it('falls back to request anonymous ID cookies', () => {
    const { forRequest, sdk } = createSdk()

    bindNextjsOptimizationRequest(sdk, {
      consent: { events: true, persistence: true },
      cookies: {
        get: () => undefined,
      },
      request: {
        cookies: {
          get: () => ({ value: 'request-anonymous-id' }),
        },
        headers: new Headers(),
        url: 'https://example.com/',
      },
    })

    expect(forRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: { id: 'request-anonymous-id' },
      }),
    )
  })

  it('calls page through the request-bound Node SDK', async () => {
    const page = rs.fn<CoreStatelessRequest['page']>(
      async () =>
        await Promise.resolve({
          accepted: true,
          data: {
            ...optimizationData,
            profile: { ...optimizationData.profile, id: 'profile-from-page' },
          },
        }),
    )
    const { sdk } = createSdk(page)

    const result = await getNextjsServerOptimizationData(sdk, {
      consent: true,
      pagePayload: { properties: { path: '/home' } },
    })

    expect(page).toHaveBeenCalledWith({ properties: { path: '/home' } })
    expect(result.data?.profile.id).toBe('profile-from-page')
  })

  it('persists anonymous ID when the Node request allows persistence', () => {
    const set = rs.fn()
    const { sdk } = createSdk()
    const requestOptimization = bindNextjsOptimizationRequest(sdk, {
      consent: { events: true, persistence: true },
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
})
