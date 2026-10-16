/** @rstest-environment node */
import { NextFetchEvent as NextFetchEventConstructor } from 'next/dist/server/web/spec-extension/fetch-event.js'
import { NextRequest, NextResponse, type NextFetchEvent } from 'next/server'
import { createNextjsOptimizationContextHandler } from './request-handler'
import {
  configureNextjsServerOptimization,
  type NextjsOptimizationServerConsentResolver,
} from './server'

const sdkConfig = { spaceId: 'key_123', environment: 'main' }
const profileId = 'f0837d7dc6344c36a3a0a06c4cde754b'

function createNextFetchEvent(request: NextRequest): NextFetchEvent {
  return new NextFetchEventConstructor({ context: { waitUntil: rs.fn() }, page: '/', request })
}

afterEach(() => {
  rs.restoreAllMocks()
})

describe('createNextjsOptimizationContextHandler', () => {
  it('forwards the visible URL and sanitized context without SDK work', async () => {
    const requestHandler = createNextjsOptimizationContextHandler()
    const response = await requestHandler(
      new NextRequest('https://example.com/products?search=two%20words&_rsc=123', {
        headers: {
          'user-agent': 'test-agent',
          'x-ctfl-opt-request-url': 'https://attacker.test/forged',
          'x-ctfl-opt-extra': 'forged',
        },
      }),
    )
    expect(response.headers.get('x-middleware-request-user-agent')).toBe('test-agent')
    expect(response.headers.get('x-middleware-request-x-ctfl-opt-extra')).toBeNull()
    expect(response.headers.get('x-middleware-request-x-ctfl-opt-request-url')).toBe(
      'https://example.com/products?search=two+words',
    )
  })

  it('preserves prior request overrides, response headers and cookies', async () => {
    const request = new NextRequest('https://example.com/products?tab=featured', {
      headers: { 'user-agent': 'test-agent' },
    })
    const headers = new Headers(request.headers)
    headers.set('x-existing-request-handler', 'preserved')
    headers.set('x-ctfl-opt-extra', 'stale')
    const prior = NextResponse.next({ request: { headers } })
    prior.headers.set('x-existing-handler', 'preserved')
    prior.cookies.set('app-cookie', '1')
    const response = await createNextjsOptimizationContextHandler()(request, prior)
    expect(response).toBe(prior)
    expect(response.headers.get('x-existing-handler')).toBe('preserved')
    expect(response.cookies.get('app-cookie')?.value).toBe('1')
    expect(response.headers.get('x-middleware-request-x-existing-request-handler')).toBe(
      'preserved',
    )
    expect(response.headers.get('x-middleware-override-headers')?.split(',')).toContain(
      'x-existing-request-handler',
    )
    expect(response.headers.get('x-middleware-request-x-ctfl-opt-extra')).toBeNull()
  })

  it('refreshes an API-issued identity cookie on a rewrite without evaluating Experience', async () => {
    const sdk = configureNextjsServerOptimization(sdkConfig)
    const upsert = rs.spyOn(sdk.api.experience, 'upsertProfile')
    const get = rs.spyOn(sdk.api.experience, 'getProfile')
    const handler = createNextjsOptimizationContextHandler({
      consent: true,
      sdk,
      cookieOptions: {
        domain: 'example.com',
        path: '/products',
        sameSite: 'strict',
        secure: true,
        maxAge: 86400,
        httpOnly: true,
      },
    })
    const request = new NextRequest('https://example.com/products', {
      headers: { cookie: `ctfl-opt-aid=${profileId}` },
    })
    const prior = NextResponse.rewrite(new URL('/rewritten', request.url))
    const response = await handler(request, prior)
    expect(response).toBe(prior)
    expect(response.headers.get('x-middleware-rewrite')).toBe('https://example.com/rewritten')
    expect(response.headers.get('x-middleware-request-cookie')).toBe(`ctfl-opt-aid=${profileId}`)
    expect(response.cookies.get('ctfl-opt-aid')).toMatchObject({
      value: profileId,
      domain: 'example.com',
      path: '/products',
      sameSite: 'strict',
      secure: true,
      maxAge: 86400,
      httpOnly: false,
    })
    expect(upsert).not.toHaveBeenCalled()
    expect(get).not.toHaveBeenCalled()
  })

  it('leaves identity absent when no API-issued ID is known', async () => {
    const sdk = configureNextjsServerOptimization(sdkConfig)
    const upsert = rs.spyOn(sdk.api.experience, 'upsertProfile')
    const response = await createNextjsOptimizationContextHandler({ consent: true, sdk })(
      new NextRequest('https://example.com/products'),
    )
    expect(response.cookies.get('ctfl-opt-aid')).toBeUndefined()
    expect(upsert).not.toHaveBeenCalled()
  })

  it.each(['json', 'redirect'] as const)('preserves a terminal %s response', async (kind) => {
    const sdk = configureNextjsServerOptimization(sdkConfig)
    const forRequest = rs.spyOn(sdk, 'forRequest')
    const consent = rs.fn(() => true)
    const prior =
      kind === 'json'
        ? NextResponse.json({ error: 'unauthorized' }, { status: 401 })
        : NextResponse.redirect('https://example.com/login')
    const response = await createNextjsOptimizationContextHandler({ consent, sdk })(
      new NextRequest('https://example.com/products'),
      prior,
    )
    expect(response).toBe(prior)
    expect(consent).not.toHaveBeenCalled()
    expect(forRequest).not.toHaveBeenCalled()
    expect(response.headers.get('x-middleware-override-headers')).toBeNull()
  })

  it('accepts the middleware event argument', async () => {
    const request = new NextRequest('https://example.com/products')
    const response = await createNextjsOptimizationContextHandler()(
      request,
      createNextFetchEvent(request),
    )
    expect(response.headers.get('x-middleware-request-x-ctfl-opt-request-url')).toBe(request.url)
  })

  it('uses prior cookie overrides for consent and identity', async () => {
    const sdk = configureNextjsServerOptimization(sdkConfig)
    const forRequest = rs.spyOn(sdk, 'forRequest')
    const consent: NextjsOptimizationServerConsentResolver = ({ cookies }) =>
      cookies.get('consent')?.value === 'yes'
    const request = new NextRequest('https://example.com/products', {
      headers: { cookie: 'consent=no; ctfl-opt-aid=old-id' },
    })
    const headers = new Headers(request.headers)
    headers.set('cookie', `consent=yes; ctfl-opt-aid=${profileId}`)
    const prior = NextResponse.next({ request: { headers } })
    const response = await createNextjsOptimizationContextHandler({ consent, sdk })(request, prior)
    expect(forRequest).toHaveBeenCalledWith(
      expect.objectContaining({ consent: true, profile: { id: profileId } }),
    )
    expect(response.cookies.get('ctfl-opt-aid')?.value).toBe(profileId)
    expect(response.headers.get('x-middleware-request-cookie')).toBe(headers.get('cookie'))
  })

  it('respects a removed cookie header in prior request overrides', async () => {
    const sdk = configureNextjsServerOptimization(sdkConfig)
    const forRequest = rs.spyOn(sdk, 'forRequest')
    const request = new NextRequest('https://example.com/products', {
      headers: { cookie: `ctfl-opt-aid=${profileId}` },
    })
    const prior = NextResponse.next({ request: { headers: new Headers({ 'user-agent': 'test' }) } })
    const response = await createNextjsOptimizationContextHandler({ consent: true, sdk })(
      request,
      prior,
    )
    expect(forRequest).toHaveBeenCalledWith(expect.objectContaining({ profile: undefined }))
    expect(response.cookies.get('ctfl-opt-aid')).toBeUndefined()
  })

  it('clears the cookie using configured scope when persistence is denied', async () => {
    const sdk = configureNextjsServerOptimization(sdkConfig)
    const handler = createNextjsOptimizationContextHandler({
      consent: { events: true, persistence: false },
      sdk,
      cookieOptions: { domain: 'example.com', path: '/products', secure: true, sameSite: 'strict' },
    })
    const response = await handler(
      new NextRequest('https://example.com/products', {
        headers: { cookie: `ctfl-opt-aid=${profileId}` },
      }),
    )
    expect(response.cookies.get('ctfl-opt-aid')).toMatchObject({
      value: '',
      domain: 'example.com',
      path: '/products',
      maxAge: 0,
      secure: true,
      sameSite: 'strict',
    })
    expect(response.headers.get('set-cookie')).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT')
  })
})
