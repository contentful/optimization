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

export type TrackEntryInteractionOptions = AutoTrackEntryInteractionOptions
export type OptimizationRootSdkConfig = Omit<OptimizationWebConfig, 'autoTrackEntryInteraction'>

export interface OptimizationRootSdk
  extends
    OptimizedEntrySdk,
    Partial<
      Omit<ContentfulOptimization, 'fetchContentfulEntry' | 'states' | 'resolveOptimizedEntry'>
    > {
  readonly states: OptimizedEntrySdk['states'] & {
    readonly previewPanelOpen: Observable<boolean>
  }
  destroy: () => void
  setLocale: (locale: string) => string | undefined
}

export type OnStatesReady<TSdk extends OptimizationRootSdk = OptimizationRootSdk> = (
  states: TSdk['states'],
) => OnStatesReadyResult

export interface OptimizationRootSdkBinding<
  TSdk extends OptimizationRootSdk = OptimizationRootSdk,
> {
  readonly cleanup?: Cleanup
  readonly ownsInstance: boolean
  readonly sdk: TSdk
}

export interface CreateInjectedOptimizationRootSdkBindingOptions<TSdk extends OptimizationRootSdk> {
  readonly onStatesReady?: OnStatesReady<TSdk>
  readonly sdk: TSdk
}

export interface CreateOwnedOptimizationRootSdkBindingOptions<
  TSdk extends OptimizationRootSdk = OptimizationRootSdk,
> {
  readonly config: OptimizationRootSdkConfig
  readonly createSdk: (config: OptimizationWebConfig) => TSdk
  readonly onStatesReady?: OnStatesReady<TSdk>
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

export function resolveTrackEntryInteractionOptions(
  trackEntryInteraction: TrackEntryInteractionOptions | undefined,
): Required<AutoTrackEntryInteractionOptions> {
  return resolveAutoTrackEntryInteractionOptions(trackEntryInteraction)
}

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

export function disposeOptimizationRootSdkBinding(
  sdkBinding: OptimizationRootSdkBinding | undefined,
): void {
  sdkBinding?.cleanup?.()
  if (sdkBinding?.ownsInstance === true) {
    sdkBinding.sdk.destroy()
  }
}
