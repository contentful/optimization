import Optimization from '@contentful/optimization-node'
import express, { type Express } from 'express'
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 900_000,
  max: 5,
})

const app: Express = express()
app.use(limiter)

const sdk = new Optimization({
  optimizationKey: process.env.VITE_NINETAILED_CLIENT_ID ?? '',
  optimizationEnv: process.env.VITE_NINETAILED_ENVIRONMENT ?? '',
  contentToken: process.env.VITE_CONTENTFUL_TOKEN ?? '',
  contentEnv: process.env.VITE_CONTENTFUL_ENVIRONMENT ?? '',
  contentSpaceId: process.env.VITE_CONTENTFUL_SPACE_ID ?? '',
  logLevel: 'debug',
  api: {
    analytics: { baseUrl: process.env.VITE_INSIGHTS_API_BASE_URL },
    personalization: { baseUrl: process.env.VITE_EXPERIENCE_API_BASE_URL },
  },
})

app.get('/', (_req, res) => {
  res.send(sdk.config.optimizationKey)
})

const port = 3000

app.listen(port, () => {
  // eslint-disable-next-line no-console -- debug
  console.log(`Express is listening at http://localhost:${port}`)
})

export default app
