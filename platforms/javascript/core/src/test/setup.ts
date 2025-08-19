import { setupServer } from 'msw/node'
import { getHandlers } from './experience-handlers'

export const server = setupServer(...getHandlers())

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
