import React, { useCallback, useState } from 'react'
import { LayoutAnimation, Platform, StyleSheet, Text, UIManager, View } from 'react-native'
import { borderRadius, colors, spacing, typography } from '../styles/theme'
import type { AudienceItemProps, ExperienceDefinition, PersonalizationOverride } from '../types'
import { copyToClipboard } from '../utils'
import { AudienceItemHeader } from './AudienceItemHeader'
import { ExperienceCard } from './ExperienceCard'

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

interface RenderExperienceCardParams {
  experience: ExperienceDefinition
  experienceOverrides: Record<string, PersonalizationOverride>
  isActive: boolean
  handlers: {
    onSetVariant: (experienceId: string, variantIndex: number) => void
    onResetExperience: (experienceId: string) => void
  }
}

/** Renders a single experience card with override handling */
const renderExperienceCard = ({
  experience,
  experienceOverrides,
  isActive,
  handlers,
}: RenderExperienceCardParams): React.JSX.Element => {
  const { [experience.id]: override } = experienceOverrides
  const hasOverride = override != null
  const currentVariantIndex = hasOverride ? override.variantIndex : 0
  const { onSetVariant, onResetExperience } = handlers

  return (
    <ExperienceCard
      key={experience.id}
      experience={experience}
      isAudienceActive={isActive}
      currentVariantIndex={currentVariantIndex}
      defaultVariantIndex={0}
      onSetVariant={(variantIndex) => {
        onSetVariant(experience.id, variantIndex)
      }}
      onReset={
        hasOverride
          ? () => {
              onResetExperience(experience.id)
            }
          : undefined
      }
      hasOverride={hasOverride}
    />
  )
}

/**
 * Individual audience row with collapsible experience list.
 *
 * Supports both controlled and uncontrolled expansion modes:
 * - Controlled: Pass isExpanded and onToggleExpand props
 * - Uncontrolled: Component manages its own expansion state
 */
export const AudienceItem = ({
  audienceWithExperiences,
  onToggle,
  onSetVariant,
  onResetExperience,
  experienceOverrides,
  isExpanded: controlledExpanded,
  onToggleExpand,
}: AudienceItemProps): React.JSX.Element => {
  const [localExpanded, setLocalExpanded] = useState(false)
  const isControlled = controlledExpanded !== undefined && onToggleExpand !== undefined
  const isExpanded = isControlled ? controlledExpanded : localExpanded
  const { audience, experiences, isQualified, isActive, overrideState } = audienceWithExperiences

  const handleToggleExpand = useCallback((): void => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    if (isControlled) {
      // onToggleExpand is guaranteed to be defined when isControlled is true

      onToggleExpand()
    } else {
      setLocalExpanded((prev) => !prev)
    }
  }, [isControlled, onToggleExpand])

  const handleLongPress = useCallback((): void => {
    copyToClipboard(audience.id, 'Audience ID')
  }, [audience.id])

  return (
    <View style={styles.container}>
      <AudienceItemHeader
        audience={audience}
        experiences={experiences}
        isExpanded={isExpanded}
        isQualified={isQualified}
        overrideState={overrideState}
        onToggleExpand={handleToggleExpand}
        onLongPress={handleLongPress}
        onToggle={onToggle}
      />

      {isExpanded && (
        <View style={styles.experienceList}>
          {experiences.length > 0 ? (
            experiences.map((exp) =>
              renderExperienceCard({
                experience: exp,
                experienceOverrides,
                isActive,
                handlers: { onSetVariant, onResetExperience },
              }),
            )
          ) : (
            <View style={styles.emptyExperiences}>
              <Text style={styles.emptyText}>No experiences target this audience</Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.secondary, // gray-50 to match web panel
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  experienceList: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  emptyExperiences: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    fontStyle: 'italic',
  },
})

export default AudienceItem
