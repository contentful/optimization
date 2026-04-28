/**
 * Tracks a manual variant selection override.
 *
 * @public
 */
export interface OptimizationOverride {
  /** Experience ID being overridden */
  experienceId: string
  /** The variant index to force (0 = baseline) */
  variantIndex: number
}

/**
 * Tracks a manual audience activation or deactivation override.
 *
 * @public
 */
export interface AudienceOverride {
  /** Audience ID being overridden */
  audienceId: string
  /** Whether the audience is activated (true) or deactivated (false) */
  isActive: boolean
  /** Source of the override - 'manual' for user-initiated */
  source: 'manual'
  /** Experience IDs that were set with this audience override */
  experienceIds: string[]
}

/**
 * Combined override state managed by the preview panel.
 *
 * @public
 */
export interface OverrideState {
  /** Map of audience ID to override */
  audiences: Record<string, AudienceOverride>
  /** Map of experience ID to override */
  selectedOptimizations: Record<string, OptimizationOverride>
}
