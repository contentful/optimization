import type { NextFetchEvent } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { createNextjsOptimizationRequestHandler } from './request-handler'
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

function createNextFetchEvent(): NextFetchEvent {
  const event = {
    waitUntil: rs.fn(),
  }

  if (isNextFetchEvent(event)) {
    return event
  }

  throw new Error('Expected test event to satisfy NextFetchEvent.')
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNextFetchEvent(value: unknown): value is NextFetchEvent {
  if (!isObjectRecord(value)) return false

  return typeof value.waitUntil === 'function'
}

describe('createNextjsOptimizationRequestHandler', () => {
  it('binds a NextRequest, calls page, and persists the returned profile', async () => {
    const sdk = createNextjsOptimization(SDK_CONFIG)
    const upsertProfile = rs
      .spyOn(sdk.api.experience, 'upsertProfile')
      .mockResolvedValue(OPTIMIZATION_DATA)
    const requestHandler = createNextjsOptimizationRequestHandler(sdk, {
      getLocale: () => 'en-US',
      resolveConsent: () => ({ events: true, persistence: true }),
    })

    const request = new NextRequest('https://example.com/products?tab=featured', {
      headers: {
        'user-agent': 'test-agent',
      },
    })
    request.cookies.set('ctfl-opt-aid', 'anonymous-id')

    const response = await requestHandler(request)

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
          }),
        ],
        profileId: 'anonymous-id',
      }),
      expect.objectContaining({ locale: 'en-US' }),
    )
    expect(response.cookies.get('ctfl-opt-aid')?.value).toBe('profile-from-page')
  })

  it('applies optimization cookies to an existing response', async () => {
    const sdk = createNextjsOptimization(SDK_CONFIG)
    rs.spyOn(sdk.api.experience, 'upsertProfile').mockResolvedValue(OPTIMIZATION_DATA)
    const requestHandler = createNextjsOptimizationRequestHandler(sdk, {
      resolveConsent: () => ({ events: true, persistence: true }),
    })
    const request = new NextRequest('https://example.com/products')
    const existingResponse = NextResponse.next()
    existingResponse.headers.set('x-existing-handler', 'preserved')

    const response = await requestHandler(request, existingResponse)

    expect(response).toBe(existingResponse)
    expect(response.headers.get('x-existing-handler')).toBe('preserved')
    expect(response.cookies.get('ctfl-opt-aid')?.value).toBe('profile-from-page')
  })

  it('ignores the Next middleware/proxy event argument and returns a response', async () => {
    const sdk = createNextjsOptimization(SDK_CONFIG)
    rs.spyOn(sdk.api.experience, 'upsertProfile').mockResolvedValue(OPTIMIZATION_DATA)
    const requestHandler = createNextjsOptimizationRequestHandler(sdk, {
      resolveConsent: () => ({ events: true, persistence: true }),
    })
    const request = new NextRequest('https://example.com/products')

    const response = await requestHandler(request, createNextFetchEvent())

    expect(response).toBeInstanceOf(Response)
    expect(response.cookies.get('ctfl-opt-aid')?.value).toBe('profile-from-page')
  })

  it('supports async request callbacks and request-derived page payloads', async () => {
    const sdk = createNextjsOptimization(SDK_CONFIG)
    const upsertProfile = rs
      .spyOn(sdk.api.experience, 'upsertProfile')
      .mockResolvedValue(OPTIMIZATION_DATA)
    const requestHandler = createNextjsOptimizationRequestHandler(sdk, {
      getEventContext: async ({ request }) =>
        await Promise.resolve({
          campaign: { name: request.headers.get('x-campaign') ?? undefined },
        }),
      getLocale: async ({ request }) =>
        await Promise.resolve(request.headers.get('x-locale') ?? undefined),
      getPagePayload: async ({ request }) =>
        await Promise.resolve({
          properties: { route: request.nextUrl.pathname },
        }),
      resolveConsent: async () => await Promise.resolve({ events: true, persistence: true }),
    })
    const request = new NextRequest('https://example.com/products', {
      headers: {
        'x-campaign': 'summer',
        'x-locale': 'en-US',
      },
    })

    await requestHandler(request)

    expect(upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        events: [
          expect.objectContaining({
            context: expect.objectContaining({
              campaign: { name: 'summer' },
              locale: 'en-US',
              page: expect.objectContaining({ path: '/products' }),
            }),
            properties: expect.objectContaining({ route: '/products' }),
          }),
        ],
      }),
      expect.objectContaining({ locale: 'en-US' }),
    )
  })

  it('can skip all SDK work for a request', async () => {
    const sdk = createNextjsOptimization(SDK_CONFIG)
    const forRequest = rs.spyOn(sdk, 'forRequest')
    const upsertProfile = rs.spyOn(sdk.api.experience, 'upsertProfile')
    const requestHandler = createNextjsOptimizationRequestHandler(sdk, {
      resolveConsent: () => ({ events: true, persistence: true }),
      shouldHandleRequest: () => false,
    })
    const request = new NextRequest('https://example.com/health')
    const existingResponse = NextResponse.next()

    const response = await requestHandler(request, existingResponse)

    expect(response).toBe(existingResponse)
    expect(forRequest).not.toHaveBeenCalled()
    expect(upsertProfile).not.toHaveBeenCalled()
  })

  it('can bind the request without calling page', async () => {
    const sdk = createNextjsOptimization(SDK_CONFIG)
    const forRequest = rs.spyOn(sdk, 'forRequest')
    const upsertProfile = rs.spyOn(sdk.api.experience, 'upsertProfile')
    const requestHandler = createNextjsOptimizationRequestHandler(sdk, {
      resolveConsent: () => ({ events: true, persistence: true }),
      shouldRequestOptimization: () => false,
    })
    const request = new NextRequest('https://example.com/products')
    request.cookies.set('ctfl-opt-aid', 'anonymous-id')

    const response = await requestHandler(request)

    expect(forRequest).toHaveBeenCalledTimes(1)
    expect(upsertProfile).not.toHaveBeenCalled()
    expect(response.cookies.get('ctfl-opt-aid')?.value).toBe('anonymous-id')
  })

  it('fails open by default and reports errors', async () => {
    const failure = new Error('page failed')
    const onError = rs.fn()
    const sdk = createNextjsOptimization(SDK_CONFIG)
    rs.spyOn(sdk.api.experience, 'upsertProfile').mockRejectedValue(failure)
    const requestHandler = createNextjsOptimizationRequestHandler(sdk, {
      onError,
      resolveConsent: () => ({ events: true, persistence: true }),
    })
    const request = new NextRequest('https://example.com/products')
    const existingResponse = NextResponse.next()

    const response = await requestHandler(request, existingResponse)

    expect(response).toBe(existingResponse)
    expect(onError).toHaveBeenCalledWith(failure, { request, response: existingResponse })
  })

  it('can throw request handler errors when configured', async () => {
    const failure = new Error('page failed')
    const onError = rs.fn()
    const sdk = createNextjsOptimization(SDK_CONFIG)
    rs.spyOn(sdk.api.experience, 'upsertProfile').mockRejectedValue(failure)
    const requestHandler = createNextjsOptimizationRequestHandler(sdk, {
      errorPolicy: 'throw',
      onError,
      resolveConsent: () => ({ events: true, persistence: true }),
    })
    const request = new NextRequest('https://example.com/products')

    await expect(requestHandler(request)).rejects.toBe(failure)
    expect(onError).toHaveBeenCalled()
  })
})
