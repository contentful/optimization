import type { LogEvent, Logger } from '@contentful/optimization-core/logger'
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core'

const mockSink = {
  name: 'ReactNativeNetworkTestSink',
  ingest: rs.fn<(event: LogEvent) => void>(),
}
let activeLogger: Logger

async function waitForExpectation(assertion: () => void): Promise<void> {
  const deadline = Date.now() + 1000

  while (Date.now() < deadline) {
    try {
      assertion()
      return
    } catch {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 10)
      })
    }
  }

  assertion()
}

describe('createOnlineChangeListener', () => {
  beforeEach(async () => {
    rs.clearAllMocks()
    rs.resetModules()

    const loggerModule = await import('@contentful/optimization-core/logger')
    activeLogger = loggerModule.logger
    activeLogger.addSink(mockSink)
  })

  afterEach(() => {
    activeLogger.removeSink(mockSink.name)
  })

  describe('when NetInfo is not installed', () => {
    it('should log warning and return no-op cleanup when module throws on require', async () => {
      rs.doMock('@react-native-community/netinfo', () => {
        throw new Error('Cannot find module')
      })

      const { createOnlineChangeListener } = await import('./createOnlineChangeListener')
      const callback = rs.fn()

      const cleanup = createOnlineChangeListener(callback)

      await waitForExpectation(() => {
        expect(mockSink.ingest).toHaveBeenCalledWith({
          name: '@contentful/optimization',
          level: 'warn',
          messages: [
            '[Ctfl:O10n:RN:Network] @react-native-community/netinfo not installed. Offline detection disabled.',
          ],
        })
      })
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

      await waitForExpectation(() => {
        expect(mockSink.ingest).toHaveBeenCalledWith({
          name: '@contentful/optimization',
          level: 'warn',
          messages: [
            '[Ctfl:O10n:RN:Network] @react-native-community/netinfo not installed. Offline detection disabled.',
          ],
        })
      })
      expect(typeof cleanup).toBe('function')
    })

    it('should log warning when NetInfo module has no addEventListener', async () => {
      rs.doMock('@react-native-community/netinfo', () => ({
        default: {},
      }))

      const { createOnlineChangeListener } = await import('./createOnlineChangeListener')
      const callback = rs.fn()

      const cleanup = createOnlineChangeListener(callback)

      await waitForExpectation(() => {
        expect(mockSink.ingest).toHaveBeenCalledWith({
          name: '@contentful/optimization',
          level: 'warn',
          messages: [
            '[Ctfl:O10n:RN:Network] @react-native-community/netinfo not installed. Offline detection disabled.',
          ],
        })
      })
      expect(typeof cleanup).toBe('function')
    })

    it('should log warning when addEventListener is not a function', async () => {
      rs.doMock('@react-native-community/netinfo', () => ({
        default: { addEventListener: 'not a function' },
      }))

      const { createOnlineChangeListener } = await import('./createOnlineChangeListener')
      const callback = rs.fn()

      const cleanup = createOnlineChangeListener(callback)

      await waitForExpectation(() => {
        expect(mockSink.ingest).toHaveBeenCalledWith({
          name: '@contentful/optimization',
          level: 'warn',
          messages: [
            '[Ctfl:O10n:RN:Network] @react-native-community/netinfo not installed. Offline detection disabled.',
          ],
        })
      })
      expect(typeof cleanup).toBe('function')
    })
  })

  describe('type guard isNetInfoModule', () => {
    it('should reject module without default export', async () => {
      rs.doMock('@react-native-community/netinfo', () => ({}))

      const { createOnlineChangeListener } = await import('./createOnlineChangeListener')
      const callback = rs.fn()

      createOnlineChangeListener(callback)

      await waitForExpectation(() => {
        expect(mockSink.ingest).toHaveBeenCalled()
      })
    })

    it('should reject non-object module', async () => {
      rs.doMock('@react-native-community/netinfo', () => 'string module')

      const { createOnlineChangeListener } = await import('./createOnlineChangeListener')
      const callback = rs.fn()

      createOnlineChangeListener(callback)

      await waitForExpectation(() => {
        expect(mockSink.ingest).toHaveBeenCalled()
      })
    })
  })
})
