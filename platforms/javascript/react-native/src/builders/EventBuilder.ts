import { Dimensions, Platform } from 'react-native'

/**
 * Returns a user-agent string identifying the React Native platform and version.
 *
 * @returns A string in the format `React Native/{version} ({os})`
 *
 * @example
 * ```ts
 * getUserAgent() // "React Native/33 (ios)"
 * ```
 *
 * @internal
 */
export function getUserAgent(): string {
  return `React Native/${Platform.Version} (${Platform.OS})`
}

/**
 * Returns the default locale for event attribution.
 *
 * @returns The locale string
 *
 * @remarks
 * Currently returns a static `'en-US'`. For dynamic locale detection, configure
 * `eventBuilder.getLocale` in the SDK options with a library like `react-native-localize`.
 *
 * @internal
 */
export function getLocale(): string {
  return 'en-US'
}

/**
 * Page properties attached to outgoing events in a React Native context.
 *
 * @internal
 */
export interface PageProperties {
  path: string
  query: Record<string, string>
  referrer: string
  search: string
  title: string
  url: string
  height?: number
  width?: number
}

/**
 * Returns default page properties for event attribution in React Native.
 *
 * @returns Page properties including the current window dimensions
 *
 * @internal
 */
export function getPageProperties(): PageProperties {
  const { width, height } = Dimensions.get('window')
  return {
    path: '/',
    query: {},
    referrer: '',
    search: '',
    title: 'React Native App',
    url: 'app://',
    width,
    height,
  }
}
