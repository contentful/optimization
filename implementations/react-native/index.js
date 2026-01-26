/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native'
import App from './App'
import { name as appName } from './app.json'

// Disable LogBox warnings/errors for E2E tests to prevent toast overlays
// Check if we're running in a Detox test environment
// Detox sets certain globals and launchArgs that we can detect
const isDetoxTest =
  typeof global.__DETOX_INITIALIZED__ !== 'undefined' ||
  typeof global.__DETOX__ !== 'undefined' ||
  (typeof global !== 'undefined' && global.detox !== undefined)

if (isDetoxTest) {
  LogBox.ignoreAllLogs()
}

AppRegistry.registerComponent(appName, () => App)
