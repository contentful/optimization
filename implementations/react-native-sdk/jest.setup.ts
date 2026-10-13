import { jest } from '@jest/globals'

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest'),
)

jest.mock('@react-native-clipboard/clipboard', () =>
  jest.requireActual('@react-native-clipboard/clipboard/jest/clipboard-mock.js'),
)
