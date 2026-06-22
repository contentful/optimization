import { APP_LOCALE } from '@/lib/config'
import { optimization } from '@/lib/optimization-server'
import { createNextjsOptimizationRequestHandler } from '@contentful/optimization-nextjs/request-handler'
import type { CoreStatelessRequestConsent } from '@contentful/optimization-nextjs/server'
import type { NextRequest } from 'next/server'

const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'

function getAppConsent(request: NextRequest): CoreStatelessRequestConsent {
  const consent = request.cookies.get(APP_PERSONALIZATION_CONSENT_COOKIE)?.value

  if (consent === 'granted') return { events: true, persistence: true }
  if (consent === 'denied') return { events: false, persistence: false }

  return { events: false, persistence: false }
}

export const proxy = createNextjsOptimizationRequestHandler(optimization, {
  getLocale: () => APP_LOCALE,
  resolveConsent: ({ request }) => getAppConsent(request),
  shouldRequestOptimization: ({ consent }) =>
    typeof consent === 'object' && consent.events === true,
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
