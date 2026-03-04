import { rs } from '@rstest/core'
import { experienceApiHandlers, insightsApiHandlers, loggerMock, resetMockLogger } from 'mocks'
import { setupServer } from 'msw/node'

rs.mock('@contentful/optimization-api-client/logger', () => loggerMock)

export const server = setupServer(
  ...experienceApiHandlers.getHandlers(),
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
