/* eslint-disable @typescript-eslint/no-magic-numbers -- testing */

import { createServer } from '@mswjs/http-middleware'
import { getHandlers as getContentfulHandlers } from './contentful-handlers'
import { getHandlers as getExperienceHandlers } from './experience-handlers'
import { getHandlers as getInsightsHandlers } from './insights-handlers'

const CONTENTFUL_BASE_URL = process.env.CONTENTFUL_BASE_URL ?? 'http://localhost/contentful/'
const EXPERIENCE_BASE_URL = process.env.EXPERIENCE_BASE_URL ?? 'http://localhost/experience/'
const INSIGHTS_BASE_URL = process.env.INSIGHTS_BASE_URL ?? 'http://localhost/insights/'
const PORT = Number(process.env.PORT ?? 80)

// eslint-disable-next-line no-console -- no worries
console.log('Starting mock server...', PORT)

const app = createServer(
  ...getContentfulHandlers(CONTENTFUL_BASE_URL),
  ...getExperienceHandlers(EXPERIENCE_BASE_URL),
  ...getInsightsHandlers(INSIGHTS_BASE_URL),
)

app.listen(PORT, () => {
  // eslint-disable-next-line no-console -- no worries
  console.log(`Mock Experience API running at "${EXPERIENCE_BASE_URL}" on port "${PORT}"`)

  // eslint-disable-next-line no-console -- no worries
  console.log(`Mock Insights API running at "${INSIGHTS_BASE_URL}" on port "${PORT}"`)

  // eslint-disable-next-line no-console -- no worries
  console.log(`Mock Contentful CDA running at "${CONTENTFUL_BASE_URL}" on port "${PORT}"`)
})
