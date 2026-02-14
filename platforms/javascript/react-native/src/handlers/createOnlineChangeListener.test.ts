import { beforeEach, describe, expect, it, rs } from '@rstest/core'
import { createLoggerMock } from 'mocks/loggerMock'

// Create mock holder
const mockLogger = {
  debug: rs.fn(),
  info: rs.fn(),
  log: rs.fn(),
  warn: rs.fn(),
  error: rs.fn(),
  fatal: rs.fn(),
}

const flushAsyncImports = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('createOnlineChangeListener', () => {
  beforeEach(() => {
    rs.clearAllMocks()
    rs.resetModules()

    rs.doMock('@contentful/optimization-core', () => createLoggerMock(mockLogger))
  })

  describe('when NetInfo is not installed', () => {
    it('should log warning and return no-op cleanup when module throws on require', async () => {
      rs.doMock('@react-native-community/netinfo', () => {
        throw new Error('Cannot find module')
      })

      const { createOnlineChangeListener } = await import('./createOnlineChangeListener')
      const callback = rs.fn()

      const cleanup = createOnlineChangeListener(callback)
      await flushAsyncImports()

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RN:Network',
        '@react-native-community/netinfo not installed. Offline detection disabled.',
      )
      expect(typeof cleanup).toBe('function')

      // Cleanup should be a no-op that doesn't throw
      expect(() => {
        cleanup()
      }).not.toThrow()

      // Callback should never be called when NetInfo is not installed
      expect(callback).not.toHaveBeenCalled()
    })

    it('should log warning when NetInfo module has invalid structure (null default)', async () => {
      rs.doMock('@react-native-community/netinfo', () => ({
        default: null,
      }))

      const { createOnlineChangeListener } = await import('./createOnlineChangeListener')
      const callback = rs.fn()

      const cleanup = createOnlineChangeListener(callback)
      await flushAsyncImports()

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RN:Network',
        '@react-native-community/netinfo not installed. Offline detection disabled.',
      )
      expect(typeof cleanup).toBe('function')
    })

    it('should log warning when NetInfo module has no addEventListener', async () => {
      rs.doMock('@react-native-community/netinfo', () => ({
        default: {},
      }))

      const { createOnlineChangeListener } = await import('./createOnlineChangeListener')
      const callback = rs.fn()

      const cleanup = createOnlineChangeListener(callback)
      await flushAsyncImports()

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RN:Network',
        '@react-native-community/netinfo not installed. Offline detection disabled.',
      )
      expect(typeof cleanup).toBe('function')
    })

    it('should log warning when addEventListener is not a function', async () => {
      rs.doMock('@react-native-community/netinfo', () => ({
        default: { addEventListener: 'not a function' },
      }))

      const { createOnlineChangeListener } = await import('./createOnlineChangeListener')
      const callback = rs.fn()

      const cleanup = createOnlineChangeListener(callback)
      await flushAsyncImports()

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'RN:Network',
        '@react-native-community/netinfo not installed. Offline detection disabled.',
      )
      expect(typeof cleanup).toBe('function')
    })
  })

  describe('type guard isNetInfoModule', () => {
    it('should reject module without default export', async () => {
      rs.doMock('@react-native-community/netinfo', () => ({}))

      const { createOnlineChangeListener } = await import('./createOnlineChangeListener')
      const callback = rs.fn()

      createOnlineChangeListener(callback)
      await flushAsyncImports()

      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should reject non-object module', async () => {
      rs.doMock('@react-native-community/netinfo', () => 'string module')

      const { createOnlineChangeListener } = await import('./createOnlineChangeListener')
      const callback = rs.fn()

      createOnlineChangeListener(callback)
      await flushAsyncImports()

      expect(mockLogger.warn).toHaveBeenCalled()
    })
  })
})
