import type { AudienceOverrideState, ExperienceDefinition, PreviewActions } from '../types'

/**
 * Applies the audience toggle state change along with associated experience overrides.
 */
export function applyAudienceToggle(
  audienceId: string,
  state: AudienceOverrideState,
  experiences: ExperienceDefinition[],
  actions: PreviewActions,
): void {
  const handlers: Record<AudienceOverrideState, () => void> = {
    on: () => {
      actions.activateAudience(audienceId)
      experiences.forEach((exp) => {
        actions.setVariantOverride(exp.id, 1)
      })
    },
    off: () => {
      actions.deactivateAudience(audienceId)
      experiences.forEach((exp) => {
        actions.setVariantOverride(exp.id, 0)
      })
    },
    default: () => {
      actions.resetAudienceOverride(audienceId)
      experiences.forEach((exp) => {
        actions.resetPersonalizationOverride(exp.id)
      })
    },
  }

  handlers[state]()
}
