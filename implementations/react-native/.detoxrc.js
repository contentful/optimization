const path = require('path')
const { execSync } = require('child_process')

function getAvailableEmulator() {
  try {
    const emulatorPath = process.env.ANDROID_HOME
      ? `${process.env.ANDROID_HOME}/emulator/emulator`
      : process.env.ANDROID_SDK_ROOT
        ? `${process.env.ANDROID_SDK_ROOT}/emulator/emulator`
        : 'emulator'

    const output = execSync(`${emulatorPath} -list-avds`, { encoding: 'utf-8', stdio: 'pipe' })
    const avds = output
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => {
        return (
          line.length > 0 &&
          !line.startsWith('INFO') &&
          !line.startsWith('WARNING') &&
          !line.startsWith('ERROR') &&
          !line.includes('|') &&
          !line.includes('Storing crashdata') &&
          !line.includes('detection is enabled')
        )
      })

    if (avds.length === 0) {
      throw new Error('No Android emulators found. Please create an AVD using Android Studio.')
    }

    const selectedAvd = process.env.DETOX_AVD_NAME || avds[0]
    if (!avds.includes(selectedAvd)) {
      console.warn(
        `Warning: Specified emulator "${selectedAvd}" not found. Using "${avds[0]}" instead.`,
      )
      return avds[0]
    }

    return selectedAvd
  } catch (error) {
    console.warn(
      `Warning: Could not detect available emulators: ${error.message}. Falling back to Pixel_8_Pro_API_33`,
    )
    return 'Pixel_8_Pro_API_33'
  }
}

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
        avdName: getAvailableEmulator(),
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
