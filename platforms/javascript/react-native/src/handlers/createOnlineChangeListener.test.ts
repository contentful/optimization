import { beforeEach, describe, expect, it, vi } from 'vitest'

// Create mock holder
const mockLogger = { error: vi.fn(), warn: vi.fn() }

describe('createOnlineChangeListener', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()

    vi.doMock('@contentful/optimization-core', () => ({
      logger: mockLogger,
    }))
  })

  describe('when NetInfo is not installed', () => {
    it('should log warning and return no-op cleanup when module throws on require', async () => {
      vi.doMock('@react-native-community/netinfo', () => {
        throw new Error('Cannot find module')
      })

      const { createOnlineChangeListener } = await import('./createOnlineChangeListener')
      const callback = vi.fn()

      const cleanup = createOnlineChangeListener(callback)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[Optimization RN SDK] @react-native-community/netinfo not installed. Offline detection disabled.',
      )
      expect(typeof cleanup).toBe('function')

      // Cleanup should be a no-op that doesn't throw
      expect(() => cleanup()).not.toThrow()

      // Callback should never be called when NetInfo is not installed
      expect(callback).not.toHaveBeenCalled()
    })

    it('should log warning when NetInfo module has invalid structure (null default)', async () => {
      vi.doMock('@react-native-community/netinfo', () => ({
        default: null,
      }))

      const { createOnlineChangeListener } = await import('./createOnlineChangeListener')
      const callback = vi.fn()

      const cleanup = createOnlineChangeListener(callback)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[Optimization RN SDK] @react-native-community/netinfo not installed. Offline detection disabled.',
      )
      expect(typeof cleanup).toBe('function')
    })

    it('should log warning when NetInfo module has no addEventListener', async () => {
      vi.doMock('@react-native-community/netinfo', () => ({
        default: {},
      }))

      const { createOnlineChangeListener } = await import('./createOnlineChangeListener')
      const callback = vi.fn()

      const cleanup = createOnlineChangeListener(callback)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[Optimization RN SDK] @react-native-community/netinfo not installed. Offline detection disabled.',
      )
      expect(typeof cleanup).toBe('function')
    })

    it('should log warning when addEventListener is not a function', async () => {
      vi.doMock('@react-native-community/netinfo', () => ({
        default: { addEventListener: 'not a function' },
      }))

      const { createOnlineChangeListener } = await import('./createOnlineChangeListener')
      const callback = vi.fn()

      const cleanup = createOnlineChangeListener(callback)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[Optimization RN SDK] @react-native-community/netinfo not installed. Offline detection disabled.',
      )
      expect(typeof cleanup).toBe('function')
    })
  })

  describe('type guard isNetInfoModule', () => {
    it('should reject module without default export', async () => {
      vi.doMock('@react-native-community/netinfo', () => ({}))

      const { createOnlineChangeListener } = await import('./createOnlineChangeListener')
      const callback = vi.fn()

      createOnlineChangeListener(callback)

      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should reject non-object module', async () => {
      vi.doMock('@react-native-community/netinfo', () => 'string module')

      const { createOnlineChangeListener } = await import('./createOnlineChangeListener')
      const callback = vi.fn()

      createOnlineChangeListener(callback)

      expect(mockLogger.warn).toHaveBeenCalled()
    })
  })
})
