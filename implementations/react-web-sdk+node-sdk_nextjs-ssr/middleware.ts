import { APP_LOCALE } from '@/lib/config'
import { sdk } from '@/lib/optimization-server'
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'
import { type NextRequest, NextResponse } from 'next/server'

const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'

function getAppConsent(request: NextRequest): boolean | undefined {
  const consent = request.cookies.get(APP_PERSONALIZATION_CONSENT_COOKIE)?.value

  if (consent === 'granted') return true
  if (consent === 'denied') return false

  return undefined
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const appConsent = getAppConsent(request)
  const response = NextResponse.next()

  if (appConsent !== true) {
    response.cookies.delete(ANONYMOUS_ID_COOKIE)
    return response
  }

  const anonymousId = request.cookies.get(ANONYMOUS_ID_COOKIE)?.value
  const profile = anonymousId ? { id: anonymousId } : undefined

  const url = new URL(request.url)
  const requestOptimization = sdk.forRequest({
    consent: { events: true, persistence: true },
    locale: APP_LOCALE,
    eventContext: {
      locale: APP_LOCALE,
      page: {
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        referrer: request.headers.get('referer') ?? '',
        search: url.search,
        url: request.url,
      },
      userAgent: request.headers.get('user-agent') ?? 'next-js-server',
    },
    profile,
  })
  const data = await requestOptimization.page()

  if (requestOptimization.canPersistProfile && data?.profile.id) {
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
