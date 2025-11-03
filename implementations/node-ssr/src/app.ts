import Optimization, { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node'
import cookieParser from 'cookie-parser'
import express, { type Express } from 'express'
import rateLimit from 'express-rate-limit'

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
      api: {
        analytics: { baseUrl: '${VITE_INSIGHTS_API_BASE_URL}' },
        personalization: { baseUrl: '${VITE_EXPERIENCE_API_BASE_URL}' },
      },
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

function initSDK(anonymousId: string | undefined): Optimization {
  const url = new URL('http://localhost:3000/')

  return new Optimization({
    clientId: CLIENT_ID,
    environment: ENVIRONMENT,
    logLevel: 'debug',
    eventBuilder: {
      getAnonymousId: () => anonymousId,
      getLocale: () => 'en-US',
      getUserAgent: () => 'node-js-server',
      getPageProperties: () => ({
        path: url.pathname,
        query: {},
        referrer: 'http://localhost:3000/',
        search: url.search,
        url: url.toString(),
      }),
    },
    api: {
      analytics: { baseUrl: VITE_INSIGHTS_API_BASE_URL },
      personalization: { baseUrl: VITE_EXPERIENCE_API_BASE_URL },
    },
  })
}

app.get('/', limiter, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- req.cookies is of type any
  const cookies: Record<string, string> = req.cookies
  const anonymousId = cookies[ANONYMOUS_ID_COOKIE] ?? undefined
  const sdk = initSDK(anonymousId)

  const setId = (id: string | undefined): void => {
    res.cookie(ANONYMOUS_ID_COOKIE, id, {
      path: '/',
      domain: 'localhost',
    })
  }

  if (anonymousId) {
    const identified = await sdk.personalization.identify({ userId: anonymousId })
    setId(identified?.profile.id)
  } else {
    const { profile } = await sdk.personalization.page({})
    setId(profile.id)
  }

  res.send(render(sdk))
})

app.get('/no-cookies', limiter, (_, res) => {
  const sdk = initSDK(undefined)
  res.send(render(sdk))
})

app.use('/dist', express.static('./public/dist'))

const port = 3000

app.listen(port, () => {
  // eslint-disable-next-line no-console -- debug
  console.log(`Express is listening at http://localhost:${port}`)
})

export default app
