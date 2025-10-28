import Optimization from '@contentful/optimization-node'
import express, { type Express } from 'express'
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 900_000,
  max: 100,
})

const app: Express = express()
app.use(limiter)

const sdk = new Optimization({
  clientId: process.env.VITE_NINETAILED_CLIENT_ID ?? '',
  environment: process.env.VITE_NINETAILED_ENVIRONMENT ?? '',
  logLevel: 'debug',
  api: {
    analytics: { baseUrl: process.env.VITE_INSIGHTS_API_BASE_URL },
    personalization: { baseUrl: process.env.VITE_EXPERIENCE_API_BASE_URL },
  },
})

app.get('/', limiter, (_req, res) => {
  const response = JSON.stringify({ clientId: sdk.config.clientId })
  res.send(response)
})

const port = 3000

app.listen(port, () => {
  // eslint-disable-next-line no-console -- debug
  console.log(`Express is listening at http://localhost:${port}`)
})

export default app
