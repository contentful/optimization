const { execFile } = require('node:child_process')
const { promisify } = require('node:util')

const execFileAsync = promisify(execFile)
const sleep = promisify(setTimeout)

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

async function waitForAirplaneModeState(expectedEnabled, timeoutMs = 3000, pollMs = 200) {
  const attempts = Math.ceil(timeoutMs / pollMs)

  for (let attempt = 0; attempt < attempts; attempt++) {
    if ((await isAirplaneModeEnabled()) === expectedEnabled) {
      return true
    }
    await sleep(pollMs)
  }

  return false
}

/**
 * Disable all network connectivity on the Android emulator by enabling airplane mode.
 * This is the most reliable way to simulate offline state as it triggers
 * system-wide connectivity changes that @react-native-community/netinfo detects.
 */
async function disableNetwork() {
  if (await isAirplaneModeEnabled()) {
    return
  }

  // Enable airplane mode
  await runAdbShell(['settings', 'put', 'global', 'airplane_mode_on', '1'])
  // Broadcast the change so apps receive the connectivity update via NetInfo
  await runAdbShell([
    'am',
    'broadcast',
    '-a',
    'android.intent.action.AIRPLANE_MODE_CHANGED',
    '--ez',
    'state',
    'true',
  ])
  // Wait for state transition only as long as needed.
  const stateApplied = await waitForAirplaneModeState(true)
  if (!stateApplied) {
    await sleep(300)
  }
}

/**
 * Re-enable network connectivity on the Android emulator by disabling airplane mode.
 */
async function enableNetwork() {
  if (!(await isAirplaneModeEnabled())) {
    return
  }

  // Disable airplane mode
  await runAdbShell(['settings', 'put', 'global', 'airplane_mode_on', '0'])
  // Broadcast the change
  await runAdbShell([
    'am',
    'broadcast',
    '-a',
    'android.intent.action.AIRPLANE_MODE_CHANGED',
    '--ez',
    'state',
    'false',
  ])
  // Wait for state transition only as long as needed.
  const stateApplied = await waitForAirplaneModeState(false)
  if (!stateApplied) {
    await sleep(500)
  }
}

/**
 * Disable only WiFi connectivity (keeps mobile data if available).
 * Less reliable for offline simulation on emulators as they may report
 * connectivity through other interfaces.
 */
async function disableWifi() {
  await runAdbShell(['svc', 'wifi', 'disable'])
  await sleep(500)
}

/**
 * Enable WiFi connectivity.
 */
async function enableWifi() {
  await runAdbShell(['svc', 'wifi', 'enable'])
  await sleep(1000)
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
