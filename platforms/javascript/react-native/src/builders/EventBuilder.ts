import { Dimensions, Platform } from 'react-native'

export function getUserAgent(): string {
  return `React Native/${Platform.Version} (${Platform.OS})`
}

export function getLocale(): string {
  // React Native doesn't have built-in locale detection
  // This would typically be handled by a library like react-native-localize
  // For now, return a default
  return 'en-US'
}

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

export function getPageProperties(): PageProperties {
  const { width, height } = Dimensions.get('window')
  // Basic implementation of "page" properties, will be decided on in NT-1692.
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
