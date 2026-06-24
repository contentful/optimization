import { APP_LOCALE, APP_PERSONALIZATION_CONSENT_COOKIE } from '@/lib/config'
import { optimization } from '@/lib/optimization'
import { createNextjsOptimizationRequestHandler } from '@contentful/optimization-nextjs/request-handler'
import type { NextRequest } from 'next/server'

export const proxy = createNextjsOptimizationRequestHandler(optimization, {
  getLocale: () => APP_LOCALE,
  resolveConsent: ({ request }) => {
    const granted =
      (request as NextRequest).cookies.get(APP_PERSONALIZATION_CONSENT_COOKIE)?.value === 'granted'
    return { events: granted, persistence: granted }
  },
  shouldRequestOptimization: ({ consent }) =>
    typeof consent === 'object' && consent.events === true,
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
