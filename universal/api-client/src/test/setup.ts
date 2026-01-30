import { experienceApiHandlers } from 'mocks'
import { setupServer } from 'msw/node'
import { vi } from 'vitest'
import { loggerMock, resetMockLogger } from './mockLogger'

vi.mock('logger', () => loggerMock)

export const server = setupServer(...experienceApiHandlers.getHandlers())

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
