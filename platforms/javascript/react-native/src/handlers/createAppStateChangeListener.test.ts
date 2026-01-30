import { createLoggerMock } from 'mocks/loggerMock'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Create a holder for the AppState callback
const callbackHolder: {
  callback: ((nextAppState: 'active' | 'background' | 'inactive') => void) | null
} = { callback: null }

const mockRemove = vi.fn()
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
}

describe('createAppStateChangeListener', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    callbackHolder.callback = null
    vi.resetModules()

    // Set up mocks before each test
    vi.doMock('@contentful/optimization-core', () => createLoggerMock(mockLogger))

    vi.doMock('react-native', () => ({
      AppState: {
        addEventListener: (
          event: string,
          callback: (nextAppState: 'active' | 'background' | 'inactive') => void,
        ) => {
          if (event === 'change') {
            callbackHolder.callback = callback
          }
          return { remove: mockRemove }
        },
      },
    }))
  })

  it('should register a listener with AppState and return cleanup function', async () => {
    const { createAppStateChangeListener } = await import('./createAppStateChangeListener')
    const callback = vi.fn()

    const cleanup = createAppStateChangeListener(callback)

    expect(typeof cleanup).toBe('function')
    expect(callbackHolder.callback).not.toBeNull()
  })

  it('should invoke callback when app goes to background', async () => {
    const { createAppStateChangeListener } = await import('./createAppStateChangeListener')
    const callback = vi.fn()

    createAppStateChangeListener(callback)

    // Simulate app going to background
    callbackHolder.callback?.('background')

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled()
    })
  })

  it('should invoke callback when app goes to inactive', async () => {
    const { createAppStateChangeListener } = await import('./createAppStateChangeListener')
    const callback = vi.fn()

    createAppStateChangeListener(callback)

    // Simulate app going to inactive
    callbackHolder.callback?.('inactive')

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled()
    })
  })

  it('should NOT invoke callback when app returns to active', async () => {
    const { createAppStateChangeListener } = await import('./createAppStateChangeListener')
    const callback = vi.fn()

    createAppStateChangeListener(callback)

    // Simulate app returning to active
    callbackHolder.callback?.('active')

    // Wait a bit to ensure callback is not called
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(callback).not.toHaveBeenCalled()
  })

  it('should call subscription.remove() when cleanup function is called', async () => {
    const { createAppStateChangeListener } = await import('./createAppStateChangeListener')
    const callback = vi.fn()

    const cleanup = createAppStateChangeListener(callback)
    cleanup()

    expect(mockRemove).toHaveBeenCalled()
  })

  it('should log error but not crash when callback throws synchronously', async () => {
    const { createAppStateChangeListener } = await import('./createAppStateChangeListener')
    const error = new Error('Callback error')
    const callback = vi.fn().mockImplementation(() => {
      throw error
    })

    createAppStateChangeListener(callback)

    // Simulate app going to background
    callbackHolder.callback?.('background')

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled()
      expect(mockLogger.error).toHaveBeenCalledWith(
        'RN:AppState',
        'Error in app state callback:',
        error,
      )
    })
  })

  it('should log error but not crash when async callback rejects', async () => {
    const { createAppStateChangeListener } = await import('./createAppStateChangeListener')
    const error = new Error('Async callback error')
    const callback = vi.fn().mockRejectedValue(error)

    createAppStateChangeListener(callback)

    // Simulate app going to background
    callbackHolder.callback?.('background')

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled()
      expect(mockLogger.error).toHaveBeenCalledWith(
        'RN:AppState',
        'Error in app state callback:',
        error,
      )
    })
  })

  it('should handle multiple state transitions', async () => {
    const { createAppStateChangeListener } = await import('./createAppStateChangeListener')
    const callback = vi.fn()

    createAppStateChangeListener(callback)

    // Simulate going to background
    callbackHolder.callback?.('background')

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledTimes(1)
    })

    // Simulate returning to active (should not trigger callback)
    callbackHolder.callback?.('active')

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Still only 1 call
    expect(callback).toHaveBeenCalledTimes(1)

    // Simulate going to inactive
    callbackHolder.callback?.('inactive')

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledTimes(2)
    })
  })

  it('should handle async callbacks that resolve successfully', async () => {
    const { createAppStateChangeListener } = await import('./createAppStateChangeListener')
    const callback = vi.fn().mockResolvedValue(undefined)

    createAppStateChangeListener(callback)

    // Simulate app going to background
    callbackHolder.callback?.('background')

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled()
    })

    // No error should be logged
    expect(mockLogger.error).not.toHaveBeenCalled()
  })
})
