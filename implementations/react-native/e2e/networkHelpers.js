/**
 * Network control helpers for Android emulator E2E tests.
 *
 * Uses ADB shell commands via Detox's device.executeShellCommand() to toggle
 * network connectivity. These commands work on Android emulators in GitHub Actions CI.
 */

/**
 * Disable all network connectivity on the Android emulator by enabling airplane mode.
 * This is the most reliable way to simulate offline state as it triggers
 * system-wide connectivity changes that @react-native-community/netinfo detects.
 */
async function disableNetwork() {
  // Enable airplane mode
  await device.executeShellCommand('settings put global airplane_mode_on 1')
  // Broadcast the change so apps receive the connectivity update via NetInfo
  await device.executeShellCommand('am broadcast -a android.intent.action.AIRPLANE_MODE_CHANGED')
  // Wait for the state change to propagate
  await new Promise((resolve) => setTimeout(resolve, 1000))
}

/**
 * Re-enable network connectivity on the Android emulator by disabling airplane mode.
 */
async function enableNetwork() {
  // Disable airplane mode
  await device.executeShellCommand('settings put global airplane_mode_on 0')
  // Broadcast the change
  await device.executeShellCommand('am broadcast -a android.intent.action.AIRPLANE_MODE_CHANGED')
  // Wait for the state change to propagate and network to reconnect
  await new Promise((resolve) => setTimeout(resolve, 2000))
}

/**
 * Disable only WiFi connectivity (keeps mobile data if available).
 * Less reliable for offline simulation on emulators as they may report
 * connectivity through other interfaces.
 */
async function disableWifi() {
  await device.executeShellCommand('svc wifi disable')
  await new Promise((resolve) => setTimeout(resolve, 500))
}

/**
 * Enable WiFi connectivity.
 */
async function enableWifi() {
  await device.executeShellCommand('svc wifi enable')
  await new Promise((resolve) => setTimeout(resolve, 1000))
}

/**
 * Check if the device is currently in airplane mode.
 * @returns {Promise<boolean>} True if airplane mode is enabled.
 */
async function isAirplaneModeEnabled() {
  const result = await device.executeShellCommand('settings get global airplane_mode_on')
  return result.trim() === '1'
}

module.exports = {
  disableNetwork,
  enableNetwork,
  disableWifi,
  enableWifi,
  isAirplaneModeEnabled,
}
