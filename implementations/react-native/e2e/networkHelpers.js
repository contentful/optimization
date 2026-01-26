const { execFile } = require('node:child_process')
const { promisify } = require('node:util')

const execFileAsync = promisify(execFile)

/**
 * Network control helpers for Android emulator E2E tests.
 *
 * Uses ADB shell commands to toggle network connectivity. These commands work
 * on Android emulators in GitHub Actions CI.
 */

async function runAdbShell(command) {
  const deviceId = device.id
  const args = deviceId ? ['-s', deviceId, 'shell', ...command] : ['shell', ...command]
  const { stdout } = await execFileAsync('adb', args)
  return stdout
}

/**
 * Disable all network connectivity on the Android emulator by enabling airplane mode.
 * This is the most reliable way to simulate offline state as it triggers
 * system-wide connectivity changes that @react-native-community/netinfo detects.
 */
async function disableNetwork() {
  // Enable airplane mode
  await runAdbShell(['settings', 'put', 'global', 'airplane_mode_on', '1'])
  // Broadcast the change so apps receive the connectivity update via NetInfo
  await runAdbShell(['am', 'broadcast', '-a', 'android.intent.action.AIRPLANE_MODE_CHANGED'])
  // Wait for the state change to propagate
  await new Promise((resolve) => setTimeout(resolve, 1000))
}

/**
 * Re-enable network connectivity on the Android emulator by disabling airplane mode.
 */
async function enableNetwork() {
  // Disable airplane mode
  await runAdbShell(['settings', 'put', 'global', 'airplane_mode_on', '0'])
  // Broadcast the change
  await runAdbShell(['am', 'broadcast', '-a', 'android.intent.action.AIRPLANE_MODE_CHANGED'])
  // Wait for the state change to propagate and network to reconnect
  await new Promise((resolve) => setTimeout(resolve, 2000))
}

/**
 * Disable only WiFi connectivity (keeps mobile data if available).
 * Less reliable for offline simulation on emulators as they may report
 * connectivity through other interfaces.
 */
async function disableWifi() {
  await runAdbShell(['svc', 'wifi', 'disable'])
  await new Promise((resolve) => setTimeout(resolve, 500))
}

/**
 * Enable WiFi connectivity.
 */
async function enableWifi() {
  await runAdbShell(['svc', 'wifi', 'enable'])
  await new Promise((resolve) => setTimeout(resolve, 1000))
}

/**
 * Check if the device is currently in airplane mode.
 * @returns {Promise<boolean>} True if airplane mode is enabled.
 */
async function isAirplaneModeEnabled() {
  const result = await runAdbShell(['settings', 'get', 'global', 'airplane_mode_on'])
  return result.trim() === '1'
}

module.exports = {
  disableNetwork,
  enableNetwork,
  disableWifi,
  enableWifi,
  isAirplaneModeEnabled,
}
