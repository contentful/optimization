import { createNextjsOptimizationContextHandler } from '@contentful/optimization-nextjs/request-handler'

export const proxy = createNextjsOptimizationContextHandler()

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
