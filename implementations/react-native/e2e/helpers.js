async function clearProfileState() {
  const platform = device.getPlatform()

<<<<<<< HEAD
  await device.terminateApp()
  await device.launchApp({ delete: true })
=======
  if (platform === 'android') {
    // await device.resetApp()
  } else {
    await device.terminateApp()
    await device.launchApp({ delete: true })
  }
>>>>>>> b27ff28 ([NT-1910] Update from main and reset previous changes onto branch)
}

module.exports = {
  clearProfileState,
}
