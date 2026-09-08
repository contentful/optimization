/* eslint-disable @typescript-eslint/no-magic-numbers -- mock server defaults */

import {
  BatchExperienceEventArray,
  ExperienceEventArray,
  ExperienceResponse,
} from '@contentful/optimization-api-client/api-schemas'
import { createServer } from '@mswjs/http-middleware'
import { getHandlers as getContentfulHandlers } from 'mocks/contentful-handlers'
import { getHandlers as getExperienceHandlers } from 'mocks/experience-handlers'
import { getHandlers as getInsightsHandlers } from 'mocks/insights-handlers'
import { HttpResponse, http } from 'msw'
import { isRecord } from './capabilities'

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
  http.get('*/health', () => HttpResponse.text('ok')),
  ...getContentfulHandlers(isRecord, `*${CONTENTFUL_PATH}`),
  // The CDA is also served from the host root, because SDK clients that accept
  // only a `host[:port]` cannot express the `/contentful/` namespace above.
  // `contentful.js` has `basePath` and keeps using the prefixed mount;
  // `contentful.swift` has no equivalent and uses this one.
  ...getContentfulHandlers(isRecord, '*/'),
  ...getExperienceHandlers(
    {
      batchExperienceEventArray: BatchExperienceEventArray,
      experienceEventArray: ExperienceEventArray,
      experienceResponse: ExperienceResponse,
    },
    `*${EXPERIENCE_PATH}`,
  ),
  ...getInsightsHandlers(`*${INSIGHTS_PATH}`),
)

app.listen(PORT, () => {
  // eslint-disable-next-line no-console -- command status
  console.log(`Mock Experience API running at "${EXPERIENCE_BASE_URL}" on port "${PORT}"`)

  // eslint-disable-next-line no-console -- command status
  console.log(`Mock Insights API running at "${INSIGHTS_BASE_URL}" on port "${PORT}"`)

  // eslint-disable-next-line no-console -- command status
  console.log(`Mock Contentful CDA running at "${CONTENTFUL_BASE_URL}" on port "${PORT}"`)
})
