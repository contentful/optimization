/* eslint-disable @typescript-eslint/no-magic-numbers -- testing */

import { createServer } from '@mswjs/http-middleware'
import { getHandlers as getContentfulHandlers } from './contentful-handlers'
import { getHandlers as getExperienceHandlers } from './experience-handlers'
import { getHandlers as getInsightsHandlers } from './insights-handlers'

const CONTENTFUL_PATH = '/contentful/'
const EXPERIENCE_PATH = '/experience/'
const INSIGHTS_PATH = '/insights/'

const PORT = Number(process.env.PORT ?? 8000)
const BASE_HOST = process.env.BASE_HOST ?? 'http://localhost'

const CONTENTFUL_BASE_URL =
  process.env.CONTENTFUL_BASE_URL ?? `${BASE_HOST}:${PORT}${CONTENTFUL_PATH}`
const EXPERIENCE_BASE_URL =
  process.env.EXPERIENCE_BASE_URL ?? `${BASE_HOST}:${PORT}${EXPERIENCE_PATH}`
const INSIGHTS_BASE_URL = process.env.INSIGHTS_BASE_URL ?? `${BASE_HOST}:${PORT}${INSIGHTS_PATH}`

const app = createServer(
  ...getContentfulHandlers(`*${CONTENTFUL_PATH}`),
  ...getExperienceHandlers(`*${EXPERIENCE_PATH}`),
  ...getInsightsHandlers(`*${INSIGHTS_PATH}`),
)

const HOST = process.env.HOST ?? '0.0.0.0'

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console -- no worries
  console.log(`Mock server listening on ${HOST}:${PORT}`)

  // eslint-disable-next-line no-console -- no worries
  console.log(`Mock Experience API running at "${EXPERIENCE_BASE_URL}" on port "${PORT}"`)

  // eslint-disable-next-line no-console -- no worries
  console.log(`Mock Insights API running at "${INSIGHTS_BASE_URL}" on port "${PORT}"`)

  // eslint-disable-next-line no-console -- no worries
  console.log(`Mock Contentful CDA running at "${CONTENTFUL_BASE_URL}" on port "${PORT}"`)
})
