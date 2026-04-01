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
    api: {
      insightsBaseUrl: process.env.PUBLIC_INSIGHTS_API_BASE_URL,
      experienceBaseUrl: process.env.PUBLIC_EXPERIENCE_API_BASE_URL,
    },
  },
} as const

const sdk = new ContentfulOptimization(config.optimization)

type QsPrimitive = string | ParsedQs
type QsArray = QsPrimitive[] // Note: mixed arrays are allowed by ParsedQs
type QsValue = QsPrimitive | QsArray | undefined

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

function getUniversalEventBuilderArgs(req: Request): UniversalEventBuilderArgs {
  const url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl)
  return {
    locale: req.acceptsLanguages()[0] ?? 'en-US',
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

function getAnonymousIdFromCookies(cookies: unknown): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- req.cookies is of type any
  return (cookies as Record<string, string>)[ANONYMOUS_ID_COOKIE] ?? undefined
}

function respond(res: Response, id: string, userId?: string): void {
  res.cookie(ANONYMOUS_ID_COOKIE, id, {
    path: '/',
    sameSite: 'lax', // good default for same-site apps
  })

  res.render('index', { config, identified: userId })
}

async function getProfile(
  req: Request,
  userId?: string,
  anonymousId?: string,
): Promise<OptimizationData | undefined> {
  const args = getUniversalEventBuilderArgs(req)
  const requestOptimization = sdk.forRequest({
    locale: args.locale,
  })
  const cookieProfile = anonymousId ? { id: anonymousId } : undefined

  if (!userId) {
    return await requestOptimization.page({ ...args, profile: cookieProfile })
  }

  const identifyResponse = await requestOptimization.identify({
    ...args,
    userId,
    profile: cookieProfile,
    traits: { identified: true },
  })

  return await requestOptimization.page({
    ...args,
    profile: cookieProfile ?? { id: identifyResponse.profile.id },
  })
}

app.get('/', limiter, async (req, res) => {
  const { profile } = (await getProfile(req)) ?? {}

  respond(res, profile?.id ?? '')
})
app.get('/smoke-test', limiter, (_, res) => {
  res.render('index', { config })
})
app.get('/user/:id', limiter, async (req, res) => {
  const anonymousId = getAnonymousIdFromCookies(req.cookies)
  const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const { profile } = (await getProfile(req, userId, anonymousId)) ?? {}

  respond(res, profile?.id ?? '', userId)
})
app.use('/dist', express.static('./public/dist'))

const port = 3000

app.listen(port, () => {
  // eslint-disable-next-line no-console -- debug
  console.log(`Express is listening at http://localhost:${port}`)
})

export default app
