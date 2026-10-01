import ContentfulOptimization, {
  createRequestHandoffFromPreview,
  type OptimizationNodeConfig,
} from '@contentful/optimization-node'
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'
import type {
  InitialExperienceCommandInput,
  UniversalEventBuilderArgs,
} from '@contentful/optimization-node/core-sdk'
import type { ContentOptimizationHandoff } from '@contentful/optimization-web/handoff'
import cookieParser from 'cookie-parser'
import express, { type Express, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ParsedQs } from 'qs'

const limiter = rateLimit({
  windowMs: 30_000,
  max: 2000,
})

const app: Express = express()
app.use(cookieParser())
app.use(limiter)
const APP_LOCALE = 'en-US'

/* eslint-disable @typescript-eslint/naming-convention -- standardized var names */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
/* eslint-enable @typescript-eslint/naming-convention -- standardized var names */

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, '.'))

const optimizationConfig = {
  allowedEventTypes: [],
  spaceId: process.env.PUBLIC_CONTENTFUL_SPACE_ID ?? '',
  environment: process.env.PUBLIC_CONTENTFUL_ENVIRONMENT,
  logLevel: 'debug',
  locale: APP_LOCALE,
  api: {
    insightsBaseUrl: process.env.PUBLIC_INSIGHTS_API_BASE_URL,
    experienceBaseUrl: process.env.PUBLIC_EXPERIENCE_API_BASE_URL,
  },
} satisfies OptimizationNodeConfig

const config = {
  contentful: {
    accessToken: process.env.PUBLIC_CONTENTFUL_TOKEN,
    environment: process.env.PUBLIC_CONTENTFUL_ENVIRONMENT,
    space: process.env.PUBLIC_CONTENTFUL_SPACE_ID,
    host: process.env.PUBLIC_CONTENTFUL_CDA_HOST,
    basePath: process.env.PUBLIC_CONTENTFUL_BASE_PATH,
    insecure: Boolean(process.env.PUBLIC_CONTENTFUL_CDA_HOST),
  },
  optimization: optimizationConfig,
} as const

const sdk = new ContentfulOptimization(optimizationConfig)
const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'

type QsPrimitive = string | ParsedQs
type QsArray = QsPrimitive[] // Note: mixed arrays are allowed by ParsedQs
type QsValue = QsPrimitive | QsArray | undefined
interface ProfileResult {
  readonly appLocale: string
  readonly handoff: ContentOptimizationHandoff | undefined
}
interface RenderResponseOptions {
  readonly appConsent: boolean | undefined
  readonly appLocale: string
  readonly handoff?: ContentOptimizationHandoff
  readonly userId?: string
}

function toStringValue(value: QsValue): string | null {
  if (value === undefined) return null
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const items = value.map((v) => (typeof v === 'string' ? v : JSON.stringify(v)))
    return items.join(',')
  }
  // value is a ParsedQs object
  return JSON.stringify(value)
}

export function getQueryRecordFromRequest(qs: ParsedQs): Record<string, string> {
  return Object.keys(qs).reduce<Record<string, string>>((acc, key) => {
    const str = toStringValue(qs[key])
    if (str !== null) {
      acc[key] = str
    }
    return acc
  }, {})
}

function getUniversalEventBuilderArgs(
  req: Request,
  eventLocale: string,
): UniversalEventBuilderArgs {
  const url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl)
  return {
    locale: eventLocale,
    userAgent: req.get('User-Agent') ?? 'node-js-server',
    page: {
      path: req.path,
      query: getQueryRecordFromRequest(req.query),
      referrer: req.get('Referer') ?? '',
      search: url.search,
      url: req.url,
    },
  }
}

function getCookieValue(cookies: unknown, name: string): string | undefined {
  if (typeof cookies !== 'object' || cookies === null) return undefined

  const value: unknown = Reflect.get(cookies, name)

  return typeof value === 'string' ? value : undefined
}

function getAnonymousIdFromCookies(cookies: unknown): string | undefined {
  return getCookieValue(cookies, ANONYMOUS_ID_COOKIE)
}

function getAppConsentFromCookies(cookies: unknown): boolean | undefined {
  const consent = getCookieValue(cookies, APP_PERSONALIZATION_CONSENT_COOKIE)

  if (consent === 'granted') return true
  if (consent === 'denied') return false

  return undefined
}

function respond(
  res: Response,
  { appConsent, appLocale, handoff, userId }: RenderResponseOptions,
): void {
  res.render('index', {
    config,
    appConsent: appConsent ?? null,
    appLocale,
    identified: userId,
    optimizationHandoff: handoff ?? null,
  })
}

async function getProfile(
  req: Request,
  appConsent: boolean | undefined,
  userId?: string,
  track?: boolean,
): Promise<ProfileResult> {
  if (appConsent !== true) {
    return {
      appLocale: APP_LOCALE,
      handoff: undefined,
    }
  }

  const args = getUniversalEventBuilderArgs(req, APP_LOCALE)
  const anonymousId = getAnonymousIdFromCookies(req.cookies)
  try {
    const requestOptimization = sdk.forRequest({
      consent: { events: true, persistence: true },
      eventContext: args,
      locale: APP_LOCALE,
      ...(anonymousId === undefined ? {} : { profile: { id: anonymousId } }),
    })

    const events: InitialExperienceCommandInput[] = []
    if (userId) {
      events.push({ type: 'identify', userId, traits: { identified: true } })
    } else if (track) {
      events.push({ type: 'track', event: 'server-previewed-page' })
    }
    const routeKey = `${req.path}${new URL(req.originalUrl, 'http://localhost').search}`
    const preview = await requestOptimization.previewInitialExperience({
      ...(events.length > 0 ? { events } : {}),
      page: { properties: { url: req.originalUrl } },
    })
    if (!preview.accepted) {
      return {
        appLocale: APP_LOCALE,
        handoff: undefined,
      }
    }

    return {
      appLocale: APP_LOCALE,
      handoff: createRequestHandoffFromPreview({
        preview,
        routeKey,
        hydration: 'preserve-server',
      }),
    }
  } catch {
    // Preview is an enhancement. Do not carry request identity into a baseline fallback.
    process.emitWarning('Optimization preview failed; rendering baseline output.')
    return {
      appLocale: APP_LOCALE,
      handoff: undefined,
    }
  }
}

app.get('/', limiter, async (req, res) => {
  const appConsent = getAppConsentFromCookies(req.cookies)
  const { appLocale, handoff } = await getProfile(req, appConsent)

  respond(res, {
    appConsent,
    appLocale,
    handoff,
  })
})
app.get('/smoke-test', limiter, (_, res) => {
  res.render('index', {
    config,
    appConsent: null,
    appLocale: APP_LOCALE,
    optimizationHandoff: null,
  })
})
app.get('/user/:id', limiter, async (req, res) => {
  const appConsent = getAppConsentFromCookies(req.cookies)
  const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const { appLocale, handoff } = await getProfile(req, appConsent, userId)

  respond(res, {
    appConsent,
    appLocale,
    handoff,
    userId,
  })
})
app.get('/track', limiter, async (req, res) => {
  const appConsent = getAppConsentFromCookies(req.cookies)
  const { appLocale, handoff } = await getProfile(req, appConsent, undefined, true)

  respond(res, { appConsent, appLocale, handoff })
})
app.use('/dist', express.static('./public/dist'))

const port = 3000

app.listen(port, () => {
  // eslint-disable-next-line no-console -- debug
  console.log(`Express is listening at http://localhost:${port}`)
})

export default app
