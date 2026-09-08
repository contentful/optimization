import { rs } from '@rstest/core'
import { experienceApiHandlers, insightsApiHandlers, loggerMock, resetMockLogger } from 'mocks'
import { setupServer } from 'msw/node'
import { BatchExperienceEventArray, ExperienceEventArray, ExperienceResponse } from '../api-schemas'

rs.mock('../logger', () => loggerMock)

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
