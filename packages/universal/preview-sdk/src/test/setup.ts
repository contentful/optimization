import { rs } from '@rstest/core'
import { loggerMock, resetMockLogger } from 'mocks'

rs.mock('@contentful/optimization-api-client/logger', () => loggerMock)

beforeEach(() => {
  resetMockLogger()
})

afterEach(() => {
  resetMockLogger()
})
