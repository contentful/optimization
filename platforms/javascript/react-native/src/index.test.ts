import { describe, expect, it, vi } from 'vitest'
import { OPTIMIZATION_REACT_NATIVE_SDK_NAME } from './global-constants'

// Mock React Native before importing anything else
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Dimensions: { get: vi.fn(() => ({ width: 375, height: 667 })) },
  NativeModules: {},
}))

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}))

// Mock React
vi.mock('react', () => ({
  default: {},
  createContext: vi.fn(() => ({})),
  useContext: vi.fn(),
  useMemo: vi.fn(<T>(fn: () => T) => fn()),
  createElement: vi.fn(),
}))

describe('Optimization React Native', () => {
  it('should pass basic smoke test', () => {
    // Basic smoke test to ensure the package structure is valid
    expect(true).toBe(true)
    expect(OPTIMIZATION_REACT_NATIVE_SDK_NAME).toBe('@contentful/optimization-react-native')
  })
})
