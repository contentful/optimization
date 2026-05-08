import { sdk } from '@/lib/optimization-server'
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const anonymousId = request.cookies.get(ANONYMOUS_ID_COOKIE)?.value
  const profile = anonymousId ? { id: anonymousId } : undefined

  const url = new URL(request.url)
  const data = await sdk.page({
    locale: request.headers.get('accept-language')?.split(',')[0] ?? 'en-US',
    userAgent: request.headers.get('user-agent') ?? 'next-js-server',
    page: {
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      referrer: request.headers.get('referer') ?? '',
      search: url.search,
      url: request.url,
    },
    profile,
  })

  const response = NextResponse.next()

  if (data.profile.id) {
    response.cookies.set(ANONYMOUS_ID_COOKIE, data.profile.id, {
      path: '/',
      sameSite: 'lax',
    })
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
