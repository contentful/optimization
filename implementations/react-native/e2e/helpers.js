async function clearProfileState() {
  const platform = device.getPlatform()

  if (platform === 'android') {
    await device.resetApp()
  } else {
    await device.terminateApp()
    await device.launchApp({ delete: true })
  }
}

module.exports = {
  clearProfileState,
}
