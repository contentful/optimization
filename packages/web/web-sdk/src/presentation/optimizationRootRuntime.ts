import type { Observable } from '@contentful/optimization-core'
import type ContentfulOptimization from '../ContentfulOptimization'
import type { OptimizationWebConfig } from '../ContentfulOptimization'
import {
  resolveAutoTrackEntryInteractionOptions,
  type AutoTrackEntryInteractionOptions,
} from '../entry-tracking/resolveAutoTrackEntryInteractionOptions'
import type { OptimizedEntrySdk } from './OptimizedEntryController'

type Cleanup = () => void
type OnStatesReadyResult = Cleanup | ReturnType<Cleanup>

/**
 * Entry interaction tracking options accepted by presentation roots.
 *
 * @public
 */
export type TrackEntryInteractionOptions = AutoTrackEntryInteractionOptions

/**
 * Web SDK configuration accepted when a presentation root owns the SDK instance.
 *
 * @public
 */
export type OptimizationRootSdkConfig = Omit<OptimizationWebConfig, 'autoTrackEntryInteraction'>

/**
 * SDK surface required by presentation roots.
 *
 * @public
 */
export interface OptimizationRootSdk
  extends
    OptimizedEntrySdk,
    Partial<
      Omit<ContentfulOptimization, 'fetchContentfulEntry' | 'states' | 'resolveOptimizedEntry'>
    > {
  /** SDK states required by optimized entries and preview-panel-aware roots. */
  readonly states: OptimizedEntrySdk['states'] & {
    readonly previewPanelOpen: Observable<boolean>
  }
  /** Release SDK-owned resources. */
  destroy: () => void
  /** Warm the SDK-managed Contentful entry cache. */
  prefetchManagedEntries: ContentfulOptimization['prefetchManagedEntries']
  /** Set the active locale and return the resulting locale. */
  setLocale: (locale: string) => string | undefined
}

/**
 * Callback invoked after a presentation root has SDK states available.
 *
 * @public
 */
export type OnStatesReady<TSdk extends OptimizationRootSdk = OptimizationRootSdk> = (
  states: TSdk['states'],
) => OnStatesReadyResult

/**
 * SDK binding owned by or injected into a presentation root.
 *
 * @public
 */
export interface OptimizationRootSdkBinding<
  TSdk extends OptimizationRootSdk = OptimizationRootSdk,
> {
  /** Optional cleanup returned by `onStatesReady`. */
  readonly cleanup?: Cleanup
  /** Whether the binding created and must destroy the SDK instance. */
  readonly ownsInstance: boolean
  /** Bound SDK instance. */
  readonly sdk: TSdk
}

/**
 * Options for binding an existing SDK instance to a presentation root.
 *
 * @public
 */
export interface CreateInjectedOptimizationRootSdkBindingOptions<TSdk extends OptimizationRootSdk> {
  /** Callback invoked once SDK states are available. */
  readonly onStatesReady?: OnStatesReady<TSdk>
  /** Existing SDK instance to bind. */
  readonly sdk: TSdk
}

/**
 * Options for creating and binding a presentation-root-owned SDK instance.
 *
 * @public
 */
export interface CreateOwnedOptimizationRootSdkBindingOptions<
  TSdk extends OptimizationRootSdk = OptimizationRootSdk,
> {
  /** Web SDK configuration, excluding automatic entry tracking options. */
  readonly config: OptimizationRootSdkConfig
  /** Factory used to create the owned SDK instance. */
  readonly createSdk: (config: OptimizationWebConfig) => TSdk
  /** Callback invoked once SDK states are available. */
  readonly onStatesReady?: OnStatesReady<TSdk>
  /** Automatic entry interaction tracking options for the owned SDK. */
  readonly trackEntryInteraction?: TrackEntryInteractionOptions
}

function getCleanup<TSdk extends OptimizationRootSdk>(
  sdk: TSdk,
  onStatesReady: OnStatesReady<TSdk> | undefined,
): Cleanup | undefined {
  const cleanup = onStatesReady?.(sdk.states)
  return typeof cleanup === 'function' ? cleanup : undefined
}

function createOwnedSdkBinding<TSdk extends OptimizationRootSdk>(
  sdk: TSdk,
  onStatesReady: OnStatesReady<TSdk> | undefined,
): OptimizationRootSdkBinding<TSdk> {
  try {
    return {
      cleanup: getCleanup(sdk, onStatesReady),
      ownsInstance: true,
      sdk,
    }
  } catch (error) {
    sdk.destroy()
    throw error
  }
}

/**
 * Resolve automatic entry interaction tracking options for a presentation root.
 *
 * @public
 */
export function resolveTrackEntryInteractionOptions(
  trackEntryInteraction: TrackEntryInteractionOptions | undefined,
): Required<AutoTrackEntryInteractionOptions> {
  return resolveAutoTrackEntryInteractionOptions(trackEntryInteraction)
}

/**
 * Create an injected or owned SDK binding for a presentation root.
 *
 * @public
 */
export function createOptimizationRootSdkBinding<TSdk extends OptimizationRootSdk>(
  options:
    | CreateInjectedOptimizationRootSdkBindingOptions<TSdk>
    | CreateOwnedOptimizationRootSdkBindingOptions<TSdk>,
): OptimizationRootSdkBinding<TSdk> {
  if ('sdk' in options) {
    return {
      cleanup: getCleanup(options.sdk, options.onStatesReady),
      ownsInstance: false,
      sdk: options.sdk,
    }
  }

  const config = {
    ...options.config,
    autoTrackEntryInteraction: resolveTrackEntryInteractionOptions(options.trackEntryInteraction),
  }

  return createOwnedSdkBinding(options.createSdk(config), options.onStatesReady)
}

/**
 * Run binding cleanup and destroy an owned SDK instance.
 *
 * @public
 */
export function disposeOptimizationRootSdkBinding(
  sdkBinding: OptimizationRootSdkBinding | undefined,
): void {
  sdkBinding?.cleanup?.()
  if (sdkBinding?.ownsInstance === true) {
    sdkBinding.sdk.destroy()
  }
}
