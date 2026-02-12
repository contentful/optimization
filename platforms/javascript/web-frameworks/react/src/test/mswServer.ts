import { experienceApiHandlers, insightsApiHandlers } from 'mocks'
import { setupServer } from 'msw/node'

export const mswServer = setupServer(
  ...experienceApiHandlers.getHandlers(),
  ...insightsApiHandlers.getHandlers(),
)

export function setupMswServerLifecycle(): void {
  beforeAll(() => {
    mswServer.listen({ onUnhandledRequest: 'error' })
  })

  afterEach(() => {
    mswServer.resetHandlers()
  })

  afterAll(() => {
    mswServer.close()
  })
}
