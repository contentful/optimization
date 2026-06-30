import { NextFetchEvent as NextFetchEventConstructor } from 'next/dist/server/web/spec-extension/fetch-event.js'
import { NextRequest, NextResponse, type NextFetchEvent } from 'next/server'
import * as requestHandlerExports from './request-handler'
import { createNextjsOptimizationContextHandler } from './request-handler'

type RemovedRequestHandlerPrefix = 'createNextjsOptimization'
type RemovedRequestHandlerSuffix = 'RequestHandler'
type RemovedRequestHandlerExportName =
  `${RemovedRequestHandlerPrefix}${RemovedRequestHandlerSuffix}`
type RemovedRequestHandlerExportIsAbsent =
  RemovedRequestHandlerExportName extends keyof typeof requestHandlerExports ? false : true

const removedRequestHandlerExportIsAbsent: RemovedRequestHandlerExportIsAbsent = true
const removedRequestHandlerExportName = ['createNextjsOptimization', 'RequestHandler'].join('')

function createNextFetchEvent(request: NextRequest): NextFetchEvent {
  return new NextFetchEventConstructor({
    context: { waitUntil: rs.fn() },
    page: '/',
    request,
  })
}

describe('createNextjsOptimizationContextHandler', () => {
  it('exports only the context handler and not the removed page-producing request handler', () => {
    expect(removedRequestHandlerExportIsAbsent).toBe(true)
    expect(requestHandlerExports.createNextjsOptimizationContextHandler).toBeTypeOf('function')
    expect(removedRequestHandlerExportName in requestHandlerExports).toBe(false)
  })

  it('forwards sanitized request URL context without performing SDK work', async () => {
    const nextSpy = rs.spyOn(NextResponse, 'next')
    const requestHandler = createNextjsOptimizationContextHandler()
    const request = new NextRequest('https://example.com/products?tab=featured', {
      headers: {
        'user-agent': 'test-agent',
        'x-ctfl-opt-request-url': 'https://attacker.test/forged',
        'x-ctfl-opt-extra': 'forged-extra',
      },
    })

    const response = await requestHandler(request)
    const forwardedHeaders = (
      nextSpy.mock.calls[0]?.[0] as { request?: { headers?: Headers } } | undefined
    )?.request?.headers

    expect(response).toBeInstanceOf(Response)
    expect(forwardedHeaders?.get('user-agent')).toBe('test-agent')
    expect(forwardedHeaders?.get('x-ctfl-opt-extra')).toBeNull()
    expect(forwardedHeaders?.get('x-ctfl-opt-request-url')).toBe(
      'https://example.com/products?tab=featured',
    )
    expect(response.headers.get('x-middleware-override-headers')).toBeNull()
    expect(response.headers.get('x-middleware-request-x-ctfl-opt-extra')).toBeNull()
    nextSpy.mockRestore()
  })

  it('applies forwarded request context to an existing response while preserving response chain state', async () => {
    const requestHandler = createNextjsOptimizationContextHandler()
    const request = new NextRequest('https://example.com/products?tab=featured', {
      headers: {
        'user-agent': 'test-agent',
      },
    })
    const existingRequestHeaders = new Headers(request.headers)
    existingRequestHeaders.set('x-existing-request-handler', 'preserved')
    existingRequestHeaders.set('x-ctfl-opt-extra', 'stale-sdk-context')
    const existingResponse = NextResponse.next({ request: { headers: existingRequestHeaders } })
    existingResponse.headers.set('x-existing-handler', 'preserved')
    existingResponse.headers.set(
      'x-middleware-override-headers',
      Array.from(existingRequestHeaders.keys()).join(','),
    )

    for (const [name, value] of existingRequestHeaders) {
      existingResponse.headers.set(`x-middleware-request-${name}`, value)
    }

    const response = await requestHandler(request, existingResponse)
    const overrideHeaders = response.headers.get('x-middleware-override-headers')?.split(',')

    expect(response).toBe(existingResponse)
    expect(response.headers.get('x-existing-handler')).toBe('preserved')
    expect(overrideHeaders).toContain('x-existing-request-handler')
    expect(overrideHeaders).toContain('user-agent')
    expect(overrideHeaders).toContain('x-ctfl-opt-request-url')
    expect(overrideHeaders).not.toContain('x-ctfl-opt-extra')
    expect(response.headers.get('x-middleware-request-x-existing-request-handler')).toBe(
      'preserved',
    )
    expect(response.headers.get('x-middleware-request-x-ctfl-opt-extra')).toBeNull()
    expect(response.headers.get('x-middleware-request-x-ctfl-opt-request-url')).toBe(
      'https://example.com/products?tab=featured',
    )
  })

  it('ignores the Next middleware/proxy event argument and returns a response', async () => {
    const requestHandler = createNextjsOptimizationContextHandler()
    const request = new NextRequest('https://example.com/products')

    const response = await requestHandler(request, createNextFetchEvent(request))

    expect(response).toBeInstanceOf(Response)
    expect(response.headers.get('x-middleware-override-headers')).toBeNull()
  })
})
