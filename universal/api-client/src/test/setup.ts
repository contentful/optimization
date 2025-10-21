import { experienceApiHandlers } from 'mocks'
import { setupServer } from 'msw/node'

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
})
afterEach(() => {
  server.resetHandlers()
})
