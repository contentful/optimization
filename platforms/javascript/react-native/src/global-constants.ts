// eslint-disable-next-line @typescript-eslint/naming-convention -- Replaced at build-time
declare const __OPTIMIZATION_VERSION__: string | undefined
// eslint-disable-next-line @typescript-eslint/naming-convention -- Replaced at build-time
declare const __OPTIMIZATION_PACKAGE_NAME__: string | undefined

export const OPTIMIZATION_REACT_NATIVE_SDK_VERSION =
  typeof __OPTIMIZATION_VERSION__ === 'string' ? __OPTIMIZATION_VERSION__ : '0.0.0'
export const OPTIMIZATION_REACT_NATIVE_SDK_NAME =
  typeof __OPTIMIZATION_PACKAGE_NAME__ === 'string'
    ? __OPTIMIZATION_PACKAGE_NAME__
    : '@contentful/optimization-react-native'
