import {
  BatchExperienceEventArray,
  ExperienceEventArray,
  ExperienceResponse,
} from '@contentful/optimization-api-client/api-schemas'
import { rs } from '@rstest/core'
import { experienceApiHandlers, insightsApiHandlers, loggerMock, resetMockLogger } from 'mocks'
import { setupServer } from 'msw/node'

rs.mock('@contentful/optimization-api-client/logger', () => loggerMock)

export const server = setupServer(
  ...experienceApiHandlers.getHandlers({
    batchExperienceEventArray: BatchExperienceEventArray,
    experienceEventArray: ExperienceEventArray,
    experienceResponse: ExperienceResponse,
  }),
  ...insightsApiHandlers.getHandlers(),
)

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})
afterAll(() => {
  server.close()
})

// reset going both ways, for extra safety!
beforeEach(() => {
  server.resetHandlers()
  resetMockLogger()
})
afterEach(() => {
  server.resetHandlers()
  resetMockLogger()
})
