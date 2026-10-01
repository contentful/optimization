import { NextRequest, NextResponse } from 'next/server'
import { createNextjsOptimizationContextHandler } from './request-handler'
import { configureNextjsServerOptimization } from './server'

describe('createNextjsOptimizationContextHandler', () => {
  it('forwards a sanitized request context without Experience work, server data, or cookies', async () => {
    const sdk = configureNextjsServerOptimization({ environment: 'main', spaceId: 'key_123' })
    const upsertProfile = rs.spyOn(sdk.api.experience, 'upsertProfile')
    const handler = createNextjsOptimizationContextHandler({
      consent: true,
      sdk,
    })
    const next = rs.spyOn(NextResponse, 'next')

    const response = await handler(
      new NextRequest('https://example.com/products?tab=featured', {
        headers: {
          'user-agent': 'test-agent',
          'x-ctfl-opt-request-url': 'https://forged.example/',
          'x-ctfl-opt-server-data': 'forged',
        },
      }),
    )
    const headers = (next.mock.calls[0]?.[0] as { request?: { headers?: Headers } } | undefined)
      ?.request?.headers

    expect(response).toBeInstanceOf(Response)
    expect(upsertProfile).not.toHaveBeenCalled()
    expect(headers?.get('x-ctfl-opt-request-url')).toBe('https://example.com/products?tab=featured')
    expect(headers?.get('x-ctfl-opt-server-data')).toBeNull()
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('preserves chained rewrite state and non-SDK request overrides', async () => {
    const handler = createNextjsOptimizationContextHandler()
    const request = new NextRequest('https://example.com/products')
    const requestHeaders = new Headers({ 'x-existing': 'preserved', 'x-ctfl-opt-extra': 'forged' })
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    })
    response.headers.set('x-middleware-override-headers', 'x-existing,x-ctfl-opt-extra')
    response.headers.set('x-middleware-request-x-existing', 'preserved')
    response.headers.set('x-middleware-request-x-ctfl-opt-extra', 'forged')
    response.headers.set('x-middleware-rewrite', 'https://example.com/rewritten')

    const result = await handler(request, response)

    expect(result).toBe(response)
    expect(result.headers.get('x-middleware-rewrite')).toBe('https://example.com/rewritten')
    expect(result.headers.get('x-middleware-request-x-existing')).toBe('preserved')
    expect(result.headers.get('x-middleware-request-x-ctfl-opt-extra')).toBeNull()
    expect(result.headers.get('x-middleware-request-x-ctfl-opt-request-url')).toBe(
      'https://example.com/products',
    )
  })
})
