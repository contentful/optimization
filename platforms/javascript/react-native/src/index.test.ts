import { describe, expect, it, rs } from '@rstest/core'
import { OPTIMIZATION_REACT_NATIVE_SDK_NAME } from './global-constants'

// Mock React Native before importing anything else
rs.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Dimensions: { get: rs.fn(() => ({ width: 375, height: 667 })) },
  NativeModules: {},
}))

// Mock AsyncStorage
rs.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: rs.fn(),
    setItem: rs.fn(),
    removeItem: rs.fn(),
  },
}))

// Mock React
rs.mock('react', () => ({
  default: {},
  createContext: rs.fn(() => ({})),
  useContext: rs.fn(),
  useMemo: rs.fn(<T>(fn: () => T) => fn()),
  createElement: rs.fn(),
}))

describe('Optimization React Native', () => {
  it('should pass basic smoke test', () => {
    // Basic smoke test to ensure the package structure is valid
    expect(true).toBe(true)
    expect(OPTIMIZATION_REACT_NATIVE_SDK_NAME).toBe('@contentful/optimization-react-native')
  })
})
