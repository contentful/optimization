import Optimization, {
  ANONYMOUS_ID_COOKIE,
  type UniversalEventBuilderArgs,
} from '@contentful/optimization-node'
import cookieParser from 'cookie-parser'
import express, { type Express, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import type { ParsedQs } from 'qs'

const limiter = rateLimit({
  windowMs: 900_000,
  max: 100,
})

const app: Express = express()

app.use(cookieParser())

app.use(limiter)

const CLIENT_ID = process.env.VITE_NINETAILED_CLIENT_ID ?? ''
const ENVIRONMENT = process.env.VITE_NINETAILED_ENVIRONMENT ?? ''
const VITE_INSIGHTS_API_BASE_URL = process.env.VITE_INSIGHTS_API_BASE_URL ?? ''
const VITE_EXPERIENCE_API_BASE_URL = process.env.VITE_EXPERIENCE_API_BASE_URL ?? ''
const CONTENTFUL_TOKEN = process.env.VITE_CONTENTFUL_TOKEN ?? ''
const CONTENTFUL_ENVIRONMENT = process.env.VITE_NINETAILED_ENVIRONMENT ?? ''
const CONTENTFUL_SPACE_ID = process.env.VITE_CONTENTFUL_SPACE_ID ?? ''
const CONTENTFUL_CDA_HOST = process.env.VITE_CONTENTFUL_CDA_HOST ?? ''
const CONTENTFUL_BASE_PATH = process.env.VITE_CONTENTFUL_BASE_PATH ?? ''

const render = (sdk: Optimization): string => `<!doctype html>
<html lang="en">
  <head>
    <title>Node ESR SDK Implementation E2E Test</title>
    <script src="/dist/index.umd.cjs"></script>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/contentful@latest/dist/contentful.browser.min.js" > </script>
    <script src="/dist/index.umd.cjs" ></script>
    <link rel="stylesheet" href="/assets/style.css" />
    <script> window.response = ${JSON.stringify({ clientId: sdk.config.clientId })} </script>
  </head>
  <body>
    <h1>Node ESR SDK Implementation E2E Test</h1>
    <main>
      <section id="utility-panel">
        <h2>Utilites</h2>

        <span>
          <button id="consent">Accept Consent</button>
          <button id="unconsent">Reject Consent</button>
        </span>
        |
        <span>
          <button id="identify">Identify</button>
          <button id="unidentify">Reset Profile</button>
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
      <section>
        <div id="event-stream-panel">
          <h2>Event Stream</h2>

          <ol id="event-stream"></ol>
        </div>
      </section>
    </main>
    <template id="event-dialog">
      <li>
        <button></button>
        <dialog>
          <pre></pre>
          <form method="dialog">
            <button type="submit">Close</button>
          </form>
        </dialog>
      </li>
  </template>
  <script>
      // Initialize Contentful CDA SDK
      var contentfulClient = contentful.createClient({
        accessToken: '${CONTENTFUL_TOKEN}',
        environment: '${CONTENTFUL_ENVIRONMENT}',
        space: '${CONTENTFUL_SPACE_ID}',
        host: '${CONTENTFUL_CDA_HOST}',
        basePath: '${CONTENTFUL_BASE_PATH}',
        insecure: Boolean('${CONTENTFUL_CDA_HOST}'),
      })

      // Initialize Contentful Optimization Web SDK
      var optimization = new Optimization({
        clientId: '${CLIENT_ID}',
        environment: '${ENVIRONMENT}',
        logLevel: 'debug',
        autoTrackEntryViews: true,
        app: {
          name: document.title,
          version: '0.0.0',
        },
        analytics: { baseUrl: '${VITE_INSIGHTS_API_BASE_URL}' },
        personalization: { baseUrl: '${VITE_EXPERIENCE_API_BASE_URL}' },
      })

      window.optimization = optimization
      // Emit page event
      optimization.personalization.page()
  </script>
  <script src="/assets/script.js"></script>
  </body>
</html>
`

const sdk = new Optimization({
  clientId: CLIENT_ID,
  environment: ENVIRONMENT,
  logLevel: 'debug',
  analytics: { baseUrl: VITE_INSIGHTS_API_BASE_URL },
  personalization: { baseUrl: VITE_EXPERIENCE_API_BASE_URL },
})

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

function setAnonymousId(res: Response, id: string): void {
  res.cookie(ANONYMOUS_ID_COOKIE, id, {
    path: '/',
    domain: 'localhost',
  })
}

app.get('/', limiter, async (req, res) => {
  const universalEventBuilderArgs = getUniversalEventBuilderArgs(req)

  const anonymousId = getAnonymousIdFromCookies(req.cookies)

  const { profile } = await sdk.personalization.page({
    ...universalEventBuilderArgs,
    profile: anonymousId ? { id: anonymousId } : undefined,
  })

  setAnonymousId(res, profile.id)

  res.send(render(sdk))
})

app.get('/user/:userId', limiter, async (req, res) => {
  const universalEventBuilderArgs = getUniversalEventBuilderArgs(req)

  const anonymousId = getAnonymousIdFromCookies(req.cookies)

  const {
    params: { userId },
  } = req

  if (userId)
    await sdk.personalization.identify({
      ...universalEventBuilderArgs,
      userId,
      profile: anonymousId ? { id: anonymousId } : undefined,
    })

  const { profile } = await sdk.personalization.page({
    ...universalEventBuilderArgs,
    profile: anonymousId ? { id: anonymousId } : undefined,
  })

  setAnonymousId(res, profile.id)

  res.send(render(sdk))
})

app.get('/smoke-test', limiter, async (_, res) => {
  res.send(render(sdk))
})

app.use('/dist', express.static('./public/dist'))
app.use('/assets', express.static('./assets'))

const port = 3000

app.listen(port, () => {
  // eslint-disable-next-line no-console -- debug
  console.log(`Express is listening at http://localhost:${port}`)
})

export default app
