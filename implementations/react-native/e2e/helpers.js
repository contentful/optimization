// Timeout value for waiting for elements to become visible (in milliseconds)
const ELEMENT_VISIBILITY_TIMEOUT = 120000 // 120 seconds

async function clearProfileState() {
  const platform = device.getPlatform()

  await device.terminateApp()
  await device.launchApp({ delete: true })
}

module.exports = {
  clearProfileState,
  ELEMENT_VISIBILITY_TIMEOUT,
}
