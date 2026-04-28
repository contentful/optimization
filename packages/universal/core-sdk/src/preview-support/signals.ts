import type { Profile, SelectedOptimization } from '@contentful/optimization-api-client/api-schemas'

/**
 * Snapshot of the SDK signals the preview panel derives its UI from.
 *
 * @public
 */
export interface PreviewSdkSignals {
  /** Current profile from SDK */
  profile: Profile | undefined
  /** Current selected optimizations from SDK */
  selectedOptimizations: SelectedOptimization[] | undefined
  /** Current consent state */
  consent: boolean | undefined
  /** Whether SDK data is loading */
  isLoading: boolean
}
