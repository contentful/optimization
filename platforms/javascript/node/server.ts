import express, { type Express } from 'express'
import rateLimit from 'express-rate-limit'
import path from 'node:path'
import Optimization from './src'

const limiter = rateLimit({
  windowMs: 900_000,
  max: 100,
})

const app: Express = express()
app.use(limiter)

app.set('view engine', 'pug') // configure Pug as the view engine
app.set('views', path.join(__dirname, '.')) // define the directory for view templates

app.get('/', limiter, async (_req, res) => {
  const sdk = new Optimization({
    clientId: process.env.VITE_NINETAILED_CLIENT_ID ?? '',
    environment: process.env.VITE_NINETAILED_ENVIRONMENT ?? '',
    logLevel: 'debug',
    api: {
      analytics: { baseUrl: process.env.VITE_INSIGHTS_API_BASE_URL },
      personalization: { baseUrl: process.env.VITE_EXPERIENCE_API_BASE_URL },
    },
  })

  const fullProfile = await sdk.personalization.page({})
  res.render('index', { fullProfile: JSON.stringify(fullProfile, undefined, 2) })
})

const port = 3000

app.listen(port, () => {
  // eslint-disable-next-line no-console -- debug
  console.log(`Express is listening at http://localhost:${port}`)
})

export default app
