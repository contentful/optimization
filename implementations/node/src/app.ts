import Optimization from '@contentful/optimization-node'
import express, { type Express } from 'express'

const app: Express = express()
const port = 3000

const sdk = new Optimization({ clientId: 'whatever' })

app.get('/', (_req, res) => {
  res.send(sdk.config.clientId)
})

app.listen(port, () => {
  // eslint-disable-next-line no-console -- debug
  console.log(`Express is listening at http://localhost:${port}`)
})

export default app
