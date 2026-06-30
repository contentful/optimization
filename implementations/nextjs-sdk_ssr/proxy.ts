import { appConfig } from '@/lib/config'
import { getAppConsent } from '@/lib/consent'
import { optimization } from '@/lib/optimization'
import { createNextjsOptimizationRequestHandler } from '@contentful/optimization-nextjs/request-handler'

export const proxy = createNextjsOptimizationRequestHandler(optimization, {
  getLocale: () => appConfig.locale,
  resolveConsent: ({ request }) => {
    const granted = getAppConsent(request.cookies)
    return { events: granted, persistence: granted }
  },
  shouldRequestOptimization: ({ consent }) =>
    typeof consent === 'object' && consent.events === true,
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
