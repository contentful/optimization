import { NextRequest, NextResponse } from 'next/server'
import { getNextjsEsrOptimizationData } from './esr'
import { createNextjsOptimization, type OptimizationData } from './server'

const SDK_CONFIG = {
  clientId: 'key_123',
  environment: 'main',
}

const OPTIMIZATION_DATA: OptimizationData = {
  changes: [],
  selectedOptimizations: [],
  profile: {
    id: 'profile-from-page',
    stableId: 'profile-from-page',
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

describe('Next.js ESR helpers', () => {
  it('builds page context from a plain Request, reads cookies, calls page, and persists a Response cookie', async () => {
    const sdk = createNextjsOptimization(SDK_CONFIG)
    const upsertProfile = rs
      .spyOn(sdk.api.experience, 'upsertProfile')
      .mockResolvedValue(OPTIMIZATION_DATA)
    const request = new Request('https://example.com/products?tab=featured', {
      headers: {
        'user-agent': 'test-agent',
      },
    })
    request.headers.set('cookie', 'ctfl-opt-aid=anonymous-id')

    const result = await getNextjsEsrOptimizationData(sdk, {
      consent: { events: true, persistence: true },
      locale: 'en-US',
      pagePayload: { properties: { route: '/products' } },
      request,
    })

    expect(result.data?.profile.id).toBe('profile-from-page')
    expect(result.requestOptimization.profile?.id).toBe('profile-from-page')
    expect(upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        events: [
          expect.objectContaining({
            context: expect.objectContaining({
              locale: 'en-US',
              page: {
                path: '/products',
                query: { tab: 'featured' },
                referrer: '',
                search: '?tab=featured',
                url: 'https://example.com/products?tab=featured',
              },
              userAgent: 'test-agent',
            }),
            properties: expect.objectContaining({ route: '/products' }),
          }),
        ],
        profileId: 'anonymous-id',
      }),
      expect.objectContaining({ locale: 'en-US' }),
    )

    const response = new Response('<html></html>', {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
    result.persist(response)

    expect(response.headers.get('set-cookie')).toContain('ctfl-opt-aid=profile-from-page')
    expect(response.headers.get('set-cookie')).toContain('Path=/')
    expect(response.headers.get('set-cookie')).toContain('SameSite=Lax')
  })

  it('reads anonymous ID from NextRequest cookies and persists through NextResponse cookies', async () => {
    const sdk = createNextjsOptimization(SDK_CONFIG)
    const upsertProfile = rs
      .spyOn(sdk.api.experience, 'upsertProfile')
      .mockResolvedValue(OPTIMIZATION_DATA)
    const request = new NextRequest('https://example.com/products', {
      headers: {
        'user-agent': 'test-agent',
      },
    })
    request.cookies.set('ctfl-opt-aid', 'next-anonymous-id')

    const result = await getNextjsEsrOptimizationData(sdk, {
      consent: { events: true, persistence: true },
      request,
    })
    const response = NextResponse.next()
    result.persist(response)

    expect(upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: 'next-anonymous-id' }),
      undefined,
    )
    expect(response.cookies.get('ctfl-opt-aid')?.value).toBe('profile-from-page')
  })

  it('clears the Response cookie when profile persistence is not allowed', async () => {
    const sdk = createNextjsOptimization(SDK_CONFIG)
    rs.spyOn(sdk.api.experience, 'upsertProfile').mockResolvedValue(OPTIMIZATION_DATA)

    const result = await getNextjsEsrOptimizationData(sdk, {
      consent: { events: true, persistence: false },
      request: new Request('https://example.com/products'),
    })
    const response = new Response('<html></html>')
    result.persist(response)

    expect(response.headers.get('set-cookie')).toContain('ctfl-opt-aid=')
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(response.headers.get('set-cookie')).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT')
  })
})
