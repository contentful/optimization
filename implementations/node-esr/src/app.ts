import Optimization, {
  ANONYMOUS_ID_COOKIE,
  type OptimizationData,
  type UniversalEventBuilderArgs,
} from '@contentful/optimization-node'
import cookieParser from 'cookie-parser'
import express, { type Express, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import type { ParsedQs } from 'qs'

const limiter = rateLimit({
  windowMs: 30_000,
  max: 2000,
})

const app: Express = express()
app.use(cookieParser())
app.use(limiter)

const config = {
  contentful: {
    accessToken: process.env.VITE_CONTENTFUL_TOKEN,
    environment: process.env.VITE_NINETAILED_ENVIRONMENT,
    space: process.env.VITE_CONTENTFUL_SPACE_ID,
    host: process.env.VITE_CONTENTFUL_CDA_HOST,
    basePath: process.env.VITE_CONTENTFUL_BASE_PATH,
    insecure: Boolean(process.env.VITE_CONTENTFUL_CDA_HOST),
  },
  optimization: {
    clientId: process.env.VITE_NINETAILED_CLIENT_ID ?? '',
    environment: process.env.VITE_NINETAILED_ENVIRONMENT,
    logLevel: 'debug',
    analytics: { baseUrl: process.env.VITE_INSIGHTS_API_BASE_URL },
    personalization: { baseUrl: process.env.VITE_EXPERIENCE_API_BASE_URL },
  },
} as const

const render = (identified?: string): string => `<!doctype html>
<html lang="en">
  <head>
    <title>Node ESR SDK Implementation E2E Test</title>
    <script src="/dist/index.umd.cjs"></script>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/contentful@latest/dist/contentful.browser.min.js" > </script>
    <script src="/dist/index.umd.cjs" ></script>
    <link rel="stylesheet" href="/assets/style.css" />
  </head>
  <body>
  <h1>Node ESR SDK Implementation E2E Test</h1>
  <main>
    <section id="utility-panel">
      <h2>Utilites</h2>
      <span>
        ${
          identified
            ? `<a href="/" >Reset Profile for: ${identified}</a>`
            : '<a href="/user/someone" >Identify</a>'
        }
      </span>
    </section>
    <section>
      <h2>Entries</h2>
        <div id="auto-observed">
          <div data-ctfl-entry-id="1JAU028vQ7v6nB2swl3NBo">
            <!-- Nested Entry -->
          </div>
          <div data-ctfl-entry-id="1MwiFl4z7gkwqGYdvCmr8c">
            <!-- Merge Tag "Rich Text" Entry -->
          </div>
          <div data-ctfl-entry-id="4ib0hsHWoSOnCVdDkizE8d"></div>
          <div data-ctfl-entry-id="xFwgG3oNaOcjzWiGe4vXo"></div>
          <div data-ctfl-entry-id="2Z2WLOx07InSewC3LUB3eX"></div>
        </div>
        <div id="manually-observed">
          <div data-entry-id="5XHssysWUDECHzKLzoIsg1"></div>
          <div data-entry-id="6zqoWXyiSrf0ja7I2WGtYj"></div>
          <div data-entry-id="7pa5bOx8Z9NmNcr7mISvD"></div>
        </div>
    </section>
  </main>
  <script> const CONFIG = ${JSON.stringify(config)} </script>
  <script src="/assets/script.js"></script>
  </body>
</html>
`

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
    domain: 'localhost',
  })

  res.send(render(userId))
}

async function getProfile(
  req: Request,
  userId?: string,
  anonymousId?: string,
): Promise<OptimizationData> {
  const sdk = new Optimization(config.optimization)
  const args = getUniversalEventBuilderArgs(req)
  const cookieProfile = anonymousId ? { id: anonymousId } : undefined

  if (!userId) {
    return await sdk.personalization.page({ ...args, profile: cookieProfile })
  }

  const { profile } = await sdk.personalization.identify({
    ...args,
    userId,
    profile: cookieProfile,
    traits: { identified: true },
  })

  return await sdk.personalization.page({
    ...args,
    profile: cookieProfile ?? { id: profile.id },
  })
}

app.get('/', limiter, async (req, res) => {
  const { profile } = await getProfile(req)

  respond(res, profile.id)
})
app.get('/smoke-test', limiter, (_, res) => res.send(render()))
app.get('/user/:id', limiter, async (req, res) => {
  const anonymousId = getAnonymousIdFromCookies(req.cookies)
  const { profile } = await getProfile(req, req.params.id, anonymousId)

  respond(res, profile.id, req.params.id)
})
app.use('/dist', express.static('./public/dist'))
app.use('/assets', express.static('./assets'))

const port = 3000

app.listen(port, () => {
  // eslint-disable-next-line no-console -- debug
  console.log(`Express is listening at http://localhost:${port}`)
})

export default app
