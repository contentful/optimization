import ContentfulOptimization, { createRequestHandoffFromData } from '@contentful/optimization-node'
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'
import type { ContentOptimizationHandoff } from '@contentful/optimization-react-web/handoff'
import type { APIContext } from 'astro'
import { CONSENT_COOKIE, optimizationConfig } from './config'

const optimization = new ContentfulOptimization(optimizationConfig)

export async function preparePersonalization({
  cookies,
  request,
  url,
}: APIContext): Promise<ContentOptimizationHandoff | undefined> {
  if (cookies.get(CONSENT_COOKIE)?.value !== 'granted') return undefined
  const profileId = cookies.get(ANONYMOUS_ID_COOKIE)?.value
  const client = optimization.forRequest({
    consent: true,
    profile: profileId ? { id: profileId } : undefined,
    eventContext: {
      userAgent: request.headers.get('user-agent') ?? '',
      page: {
        url: url.href,
        path: url.pathname,
        search: url.search,
        query: Object.fromEntries(url.searchParams),
        referrer: request.headers.get('referer') ?? '',
      },
    },
  })
  const { data, handoff } = await client.prepareRequestHandoff({
    routeKey: url.pathname + url.search,
  })
  return {
    ...handoff,
    ...createRequestHandoffFromData({ data }),
    hydration: 'preserve-server',
  }
}
