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

const sdk = new Optimization({
  clientId: CLIENT_ID,
  environment: ENVIRONMENT,
  logLevel: 'debug',
  api: {
    analytics: { baseUrl: VITE_INSIGHTS_API_BASE_URL },
    personalization: { baseUrl: VITE_EXPERIENCE_API_BASE_URL },
  },
})

const html = `<!doctype html>
<html>
  <head>
    <title>Test SDK page</title>
    <script src="/dist/index.umd.cjs"></script>
    <script> window.response = ${JSON.stringify({ clientId: sdk.config.clientId })} </script>
  </head>
  <body>
  <script>
    var optimization = new Optimization({
      clientId: '${CLIENT_ID}',
      environment: '${ENVIRONMENT}',
      logLevel: 'debug',
      api: {
        analytics: { baseUrl: '${VITE_INSIGHTS_API_BASE_URL}' },
        personalization: { baseUrl: '${VITE_EXPERIENCE_API_BASE_URL}' },
      },
    })

    var p = document.createElement('p')
    p.dataset.testid = 'clientId'
    p.innerText = optimization.config.clientId
    document.body.appendChild(p)
  </script>
  </body>
</html>
`

app.get('/', limiter, (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- req.cookies is of type any
  const cookies: Record<string, string> = req.cookies

  res.cookie(ANONYMOUS_ID_COOKIE, cookies[ANONYMOUS_ID_COOKIE] ?? 'ssr-profile-id', {
    path: '/',
    domain: 'localhost',
  })
  res.send(html)
})

app.use('/dist', express.static('./public/dist'))

const port = 3000

app.listen(port, () => {
  // eslint-disable-next-line no-console -- debug
  console.log(`Express is listening at http://localhost:${port}`)
})

export default app
