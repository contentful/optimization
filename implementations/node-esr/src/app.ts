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

const render = (sdk: Optimization): string => `<!doctype html>
<html>
  <head>
    <title>Test SDK page</title>
    <script src="/dist/index.umd.cjs"></script>
    <script> window.response = ${JSON.stringify({ clientId: sdk.config.clientId })} </script>
  </head>
  <body>
  <script>
    const optimization = new Optimization({
      clientId: '${CLIENT_ID}',
      environment: '${ENVIRONMENT}',
      logLevel: 'debug',
      analytics: { baseUrl: '${VITE_INSIGHTS_API_BASE_URL}' },
      personalization: { baseUrl: '${VITE_EXPERIENCE_API_BASE_URL}' },
    })

    function renderElement(id, text) {
      const p = document.createElement('p')
      p.dataset.testid = id
      p.innerText = text
      document.body.appendChild(p)
    }

    renderElement('clientId', optimization.config.clientId)
  </script>
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

app.get('/smoke-test', limiter, (_, res) => {
  res.send(render(sdk))
})

app.use('/dist', express.static('./public/dist'))

const port = 3000

app.listen(port, () => {
  // eslint-disable-next-line no-console -- debug
  console.log(`Express is listening at http://localhost:${port}`)
})

export default app
