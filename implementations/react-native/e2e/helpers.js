async function clearProfileState() {
  const platform = device.getPlatform()

  await device.terminateApp()
  await device.launchApp({ delete: true })
}

module.exports = {
  clearProfileState,
}
