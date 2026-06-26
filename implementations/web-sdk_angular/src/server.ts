/* eslint-disable no-console */
import { AngularNodeAppEngine, isMainModule, writeResponseToNodeResponse } from '@angular/ssr/node'
import express, { type Express } from 'express'
import rateLimit from 'express-rate-limit'
import { join } from 'node:path'

const DEFAULT_PORT = 4200
const RATE_LIMIT_WINDOW_MS = 30_000
const RATE_LIMIT_MAX = 1000

const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
})

const browserDistFolder = join(import.meta.dirname, '../browser')
const app: Express = express()
app.use(limiter)

const angularApp = new AngularNodeAppEngine()

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
)

app.use(async (req, res, next) => {
  try {
    const response = await angularApp.handle(req)
    if (response) {
      await writeResponseToNodeResponse(response, res)
    } else {
      next()
    }
  } catch (error) {
    next(error)
  }
})

if (isMainModule(import.meta.url) || process.env.pm_id) {
  const port = process.env.PORT ?? DEFAULT_PORT
  app.listen(port, (error) => {
    if (error) throw error
    console.log(`Express is listening at http://localhost:${port}`)
  })
}

export default app
