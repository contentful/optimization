import { createServer } from '@mswjs/http-middleware'
import { getHandlers as getExperienceHandlers } from './experience-handlers'
import { getHandlers as getInsightsHandlers } from './insights-handlers'

const EXPERIENCE_BASE_URL = process.env.BASE_URL ?? 'http://localhost/experience'
const INSIGHTS_BASE_URL = process.env.BASE_URL ?? 'http://localhost/insights'
const PORT = Number(process.env.PORT ?? 80)

const app = createServer(
  ...getExperienceHandlers(EXPERIENCE_BASE_URL),
  ...getInsightsHandlers(INSIGHTS_BASE_URL),
)

app.listen(PORT, () => {
  // eslint-disable-next-line no-console -- no worries
  console.log(`Mock Experience API running at "${EXPERIENCE_BASE_URL}" on port "${PORT}"`)

  // eslint-disable-next-line no-console -- no worries
  console.log(`Mock Insights API running at "${INSIGHTS_BASE_URL}" on port "${PORT}"`)
})
