// eslint-disable-next-line @typescript-eslint/naming-convention -- Replaced at build-time
declare const __OPTIMIZATION_VERSION__: string | undefined
// eslint-disable-next-line @typescript-eslint/naming-convention -- Replaced at build-time
declare const __OPTIMIZATION_PACKAGE_NAME__: string | undefined

/**
 * The current version of the Optimization React Native SDK, replaced at build time.
 *
 * @public
 */
export const OPTIMIZATION_REACT_NATIVE_SDK_VERSION =
  typeof __OPTIMIZATION_VERSION__ === 'string' ? __OPTIMIZATION_VERSION__ : '0.0.0'

/**
 * The package name of the Optimization React Native SDK, replaced at build time.
 *
 * @public
 */
export const OPTIMIZATION_REACT_NATIVE_SDK_NAME =
  typeof __OPTIMIZATION_PACKAGE_NAME__ === 'string'
    ? __OPTIMIZATION_PACKAGE_NAME__
    : '@contentful/optimization-react-native'
