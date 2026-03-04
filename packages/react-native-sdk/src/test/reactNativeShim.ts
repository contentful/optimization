interface Dimensions {
  readonly height: number
  readonly width: number
}

const DEFAULT_DIMENSIONS: Dimensions = { width: 375, height: 667 }
const noop = (): void => undefined

export const Platform = { OS: 'ios' }

export const Dimensions = {
  get: (): Dimensions => DEFAULT_DIMENSIONS,
  addEventListener: () => ({
    remove: noop,
  }),
}

export const AppState = {
  addEventListener: () => ({
    remove: noop,
  }),
}

export const NativeModules = {}

export default {
  AppState,
  Dimensions,
  NativeModules,
  Platform,
}
