import ContentfulOptimization from '@contentful/optimization-node'
import type { OptimizationData } from '@contentful/optimization-node/api-schemas'
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'
import type { UniversalEventBuilderArgs } from '@contentful/optimization-node/core-sdk'
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

/* eslint-disable @typescript-eslint/naming-convention -- standardized var names */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
/* eslint-enable @typescript-eslint/naming-convention -- standardized var names */

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, '.'))

const config = {
  contentful: {
    accessToken: process.env.PUBLIC_CONTENTFUL_TOKEN,
    environment: process.env.PUBLIC_NINETAILED_ENVIRONMENT,
    space: process.env.PUBLIC_CONTENTFUL_SPACE_ID,
    host: process.env.PUBLIC_CONTENTFUL_CDA_HOST,
    basePath: process.env.PUBLIC_CONTENTFUL_BASE_PATH,
    insecure: Boolean(process.env.PUBLIC_CONTENTFUL_CDA_HOST),
  },
  optimization: {
    clientId: process.env.PUBLIC_NINETAILED_CLIENT_ID ?? '',
    environment: process.env.PUBLIC_NINETAILED_ENVIRONMENT,
    logLevel: 'debug',
    contentfulLocales: {
      default: 'en-US',
    },
    api: {
      insightsBaseUrl: process.env.PUBLIC_INSIGHTS_API_BASE_URL,
      experienceBaseUrl: process.env.PUBLIC_EXPERIENCE_API_BASE_URL,
    },
  },
} as const

const sdk = new ContentfulOptimization(config.optimization)
const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'

function requireContentfulLocale(contentfulLocale: string | undefined): string {
  if (contentfulLocale !== undefined) return contentfulLocale

  throw new Error('This implementation requires contentfulLocales for localized CDA fetches.')
}

type QsPrimitive = string | ParsedQs
type QsArray = QsPrimitive[] // Note: mixed arrays are allowed by ParsedQs
type QsValue = QsPrimitive | QsArray | undefined
interface ProfileResult {
  readonly contentfulLocale: string
  readonly optimizationData: OptimizationData | undefined
}
interface RenderResponseOptions {
  readonly appConsent: boolean | undefined
  readonly contentfulLocale: string
  readonly id?: string
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
  { appConsent, contentfulLocale, id, userId }: RenderResponseOptions,
): void {
  if (appConsent === true && id) {
    res.cookie(ANONYMOUS_ID_COOKIE, id, {
      path: '/',
      sameSite: 'lax', // good default for same-site apps
    })
  } else {
    res.clearCookie(ANONYMOUS_ID_COOKIE, { path: '/' })
  }

  res.render('index', {
    config,
    appConsent: appConsent ?? null,
    contentfulLocale,
    identified: userId,
  })
}

async function getProfile(
  req: Request,
  appConsent: boolean | undefined,
  userId?: string,
  anonymousId?: string,
): Promise<ProfileResult> {
  const { contentfulLocale, eventLocale } = sdk.resolveRequestLocale(req)
  const resolvedContentfulLocale = requireContentfulLocale(contentfulLocale)

  if (appConsent !== true) {
    return {
      contentfulLocale: resolvedContentfulLocale,
      optimizationData: undefined,
    }
  }

  const args = getUniversalEventBuilderArgs(req, eventLocale)
  const experienceRequestOptions = { locale: resolvedContentfulLocale }
  const cookieProfile = anonymousId ? { id: anonymousId } : undefined
  const requestOptimization = sdk.forRequest({
    consent: { events: true, persistence: true },
    eventContext: args,
    experienceOptions: experienceRequestOptions,
    profile: cookieProfile,
  })

  if (!userId) {
    return {
      contentfulLocale: resolvedContentfulLocale,
      optimizationData: await requestOptimization.page(),
    }
  }

  await requestOptimization.identify({
    userId,
    traits: { identified: true },
  })

  return {
    contentfulLocale: resolvedContentfulLocale,
    optimizationData: await requestOptimization.page(),
  }
}

app.get('/', limiter, async (req, res) => {
  const appConsent = getAppConsentFromCookies(req.cookies)
  const { contentfulLocale, optimizationData } = await getProfile(req, appConsent)

  respond(res, {
    appConsent,
    contentfulLocale,
    id: optimizationData?.profile.id,
  })
})
app.get('/smoke-test', limiter, (_, res) => {
  res.render('index', {
    appConsent: null,
    config,
    contentfulLocale: config.optimization.contentfulLocales.default,
  })
})
app.get('/user/:id', limiter, async (req, res) => {
  const anonymousId = getAnonymousIdFromCookies(req.cookies)
  const appConsent = getAppConsentFromCookies(req.cookies)
  const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const { contentfulLocale, optimizationData } = await getProfile(
    req,
    appConsent,
    userId,
    anonymousId,
  )

  respond(res, {
    appConsent,
    contentfulLocale,
    id: optimizationData?.profile.id,
    userId,
  })
})
app.use('/dist', express.static('./public/dist'))

const port = 3000

app.listen(port, () => {
  // eslint-disable-next-line no-console -- debug
  console.log(`Express is listening at http://localhost:${port}`)
})

export default app
