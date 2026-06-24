import type ContentfulOptimization from './ContentfulOptimization'

/**
 * Concrete React Native SDK runtime returned by {@link useOptimization}.
 *
 * @remarks
 * Public consumers receive the concrete SDK surface, including advanced Core
 * members with their original readonly and mutable nested types.
 *
 * @public
 */
export type OptimizationSdk = ContentfulOptimization

/**
 * React Native runtime with the advanced capabilities required by preview tooling.
 *
 * @internal
 */
export type OptimizationPreviewRuntime = OptimizationSdk

/**
 * Whether the runtime exposes the advanced Core lifecycle capabilities used by preview tooling.
 *
 * @internal
 */
export function hasOptimizationPreviewRuntime(
  sdk: OptimizationSdk,
): sdk is OptimizationPreviewRuntime {
  void sdk
  return true
}

/**
 * Require the advanced Core lifecycle capabilities used by the preview panel.
 *
 * @internal
 */
export function requireOptimizationPreviewRuntime(
  sdk: OptimizationSdk,
): OptimizationPreviewRuntime {
  return sdk
}
