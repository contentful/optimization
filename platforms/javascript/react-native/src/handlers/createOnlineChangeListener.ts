import { createScopedLogger } from '@contentful/optimization-core'

const logger = createScopedLogger('RN:Network')

/**
 * Callback invoked when the device's connectivity state changes.
 *
 * The callback receives `true` when the device is online and `false` when it is offline.
 *
 * @internal
 */
type Callback = (isOnline: boolean) => Promise<void> | void

interface NetInfoState {
  isInternetReachable: boolean | null
  isConnected: boolean | null
}

interface NetInfoModule {
  default: {
    addEventListener: (listener: (state: NetInfoState) => void) => () => void
  }
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isNetInfoModule = (mod: unknown): mod is NetInfoModule => {
  if (!isObjectRecord(mod)) {
    return false
  }

  const { default: defaultExport } = mod

  return isObjectRecord(defaultExport) && typeof defaultExport.addEventListener === 'function'
}

const loadNetInfoModule = async (): Promise<NetInfoModule> => {
  const mod: unknown = await import('@react-native-community/netinfo')

  if (!isNetInfoModule(mod)) {
    throw new Error('Invalid NetInfo module')
  }

  return mod
}

/**
 * Create an online/offline listener that invokes a callback whenever the device transitions
 * between connectivity states, and returns a cleanup function to remove the listener.
 *
 * @param callback - Function invoked when the device goes online (`true`) or offline (`false`).
 *   May return a promise.
 * @returns A function that removes the registered event listener when called.
 *
 * @public
 * @remarks
 * - Requires `@react-native-community/netinfo` to be installed as a peer dependency.
 * - If NetInfo is not installed, a warning is logged and a no-op cleanup function is returned.
 * - Uses `isInternetReachable` for accurate internet connectivity detection, falling back to
 *   `isConnected` if reachability check is unavailable.
 * - The callback is invoked immediately with the initial state when the listener is created.
 *
 * @example
 * ```ts
 * const cleanup = createOnlineChangeListener(async (isOnline) => {
 *   if (isOnline) await sdk.analytics.flush()
 * })
 *
 * // Later:
 * cleanup()
 * ```
 */
export function createOnlineChangeListener(callback: Callback): () => void {
  const state = { didDispose: false }
  let unsubscribe: () => void = () => undefined

  const emit = (isOnline: boolean): void => {
    void (async () => {
      try {
        await callback(isOnline)
      } catch (error) {
        logger.error('Error in online state callback:', error)
      }
    })()
  }

  void (async () => {
    try {
      const { default: NetInfo } = await loadNetInfoModule()

      if (state.didDispose) {
        return
      }

      unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
        // Use isInternetReachable for actual connectivity (can ping external server)
        // Fall back to isConnected if reachability check unavailable (null)
        // Default to true if both are null to avoid false offline states
        const isOnline = state.isInternetReachable ?? state.isConnected ?? true
        emit(isOnline)
      })
    } catch {
      logger.warn('@react-native-community/netinfo not installed. Offline detection disabled.')
    }
  })()

  return () => {
    state.didDispose = true
    unsubscribe()
  }
}
