import Optimization from '@contentful/optimization-node'
import express, { type Express } from 'express'

const app: Express = express()
const port = 3000

const sdk = new Optimization({
  optimizationKey: process.env.VITE_NINETAILED_CLIENT_ID ?? '',
  optimizationEnv: process.env.VITE_NINETAILED_ENVIRONMENT ?? '',
  contentToken: process.env.VITE_CONTENTFUL_TOKEN ?? '',
  contentEnv: process.env.VITE_CONTENTFUL_ENVIRONMENT ?? '',
  contentSpaceId: process.env.VITE_CONTENTFUL_SPACE_ID ?? '',
  logLevel: 'debug',
  api: {
    analytics: { baseUrl: 'http://localhost/insights/' },
    personalization: { baseUrl: 'http://localhost/experience/' },
  },
})

app.get('/', (_req, res) => {
  res.send(sdk.config.optimizationKey)
})

app.listen(port, () => {
  // eslint-disable-next-line no-console -- debug
  console.log(`Express is listening at http://localhost:${port}`)
})

export default app
