const path = require('path')

/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: path.join(
        __dirname,
        'ios/build/Build/Products/Debug-iphonesimulator/OptimizationImplementationApp.app',
      ),
      build: `cd ${__dirname} && xcodebuild -workspace ios/OptimizationImplementationApp.xcworkspace -scheme OptimizationImplementationApp -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build`,
      launchArgs: {
        detoxPrintBusyIdleResources: 'YES',
      },
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath: path.join(
        __dirname,
        'ios/build/Build/Products/Release-iphonesimulator/OptimizationImplementationApp.app',
      ),
      build: `cd ${__dirname} && xcodebuild -workspace ios/OptimizationImplementationApp.xcworkspace -scheme OptimizationImplementationApp -configuration Release -sdk iphonesimulator -derivedDataPath ios/build`,
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: path.join(__dirname, 'android/app/build/outputs/apk/debug/app-debug.apk'),
      build: `cd ${__dirname}/android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug`,
      reversePorts: [8081],
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: path.join(__dirname, 'android/app/build/outputs/apk/release/app-release.apk'),
      build: `cd ${__dirname}/android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release`,
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 15 Pro',
      },
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_7_API_34',
      },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
    'android.emu.release': {
      device: 'emulator',
      app: 'android.release',
    },
  },
}
