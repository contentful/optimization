import express, { type Express } from 'express'
import NodeSDK from '@contentful/optimization-node'

const app: Express = express()
const port = 3000

const sdk = new NodeSDK()

app.get('/', (_req, res) => {
  res.send(sdk.name)
})

app.listen(port, () => {
  // eslint-disable-next-line no-console -- debug
  console.log(`Express is listening at http://localhost:${port}`)
})

export default app
