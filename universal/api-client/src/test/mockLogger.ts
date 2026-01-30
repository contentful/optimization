import { createLoggerMock, type MockLogger } from 'mocks'
import type { Mock } from 'vitest'
import { vi } from 'vitest'

type MockFn = Mock<(...args: unknown[]) => void>

interface TestMockLogger {
  debug: MockFn
  info: MockFn
  log: MockFn
  warn: MockFn
  error: MockFn
  fatal: MockFn
}

export const mockLogger: TestMockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
}

export const loggerMock = createLoggerMock(mockLogger as MockLogger)

export function resetMockLogger(): void {
  mockLogger.debug.mockClear()
  mockLogger.info.mockClear()
  mockLogger.log.mockClear()
  mockLogger.warn.mockClear()
  mockLogger.error.mockClear()
  mockLogger.fatal.mockClear()
}
