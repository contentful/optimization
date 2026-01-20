import { vi } from 'vitest'

// Manual mock for @react-native-community/netinfo

export let capturedCallback:
  | ((state: { isInternetReachable: boolean | null; isConnected: boolean | null }) => void)
  | null = null
export const mockUnsubscribe = vi.fn()

export function resetMock(): void {
  capturedCallback = null
  mockUnsubscribe.mockClear()
}

export default {
  addEventListener: (
    callback: (state: { isInternetReachable: boolean | null; isConnected: boolean | null }) => void,
  ) => {
    capturedCallback = callback
    return mockUnsubscribe
  },
}
