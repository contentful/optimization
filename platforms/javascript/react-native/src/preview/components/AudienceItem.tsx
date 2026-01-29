import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { borderRadius, colors, spacing, typography } from '../styles/theme'
import type { AudienceItemProps, ExperienceDefinition, PersonalizationOverride } from '../types'
import { copyToClipboard } from '../utils'
import { AudienceItemHeader } from './AudienceItemHeader'
import { ExperienceCard } from './ExperienceCard'

interface RenderExperienceCardParams {
  experience: ExperienceDefinition
  experienceOverrides: Record<string, PersonalizationOverride>
  sdkVariantIndices: Record<string, number>
  isActive: boolean
  handlers: {
    onSetVariant: (experienceId: string, variantIndex: number) => void
    onResetExperience: (experienceId: string) => void
  }
}

/** Renders a single experience card with override handling */
function renderExperienceCard({
  experience,
  experienceOverrides,
  sdkVariantIndices,
  isActive,
  handlers,
}: RenderExperienceCardParams): React.JSX.Element {
  const { [experience.id]: override } = experienceOverrides
  const hasOverride = override != null
  // Use SDK's actual variant index as the default, falling back to 0 if not present
  const sdkVariantIndex = sdkVariantIndices[experience.id] ?? 0
  const currentVariantIndex = hasOverride ? override.variantIndex : sdkVariantIndex
  const { onSetVariant } = handlers

  return (
    <ExperienceCard
      key={experience.id}
      experience={experience}
      isAudienceActive={isActive}
      currentVariantIndex={currentVariantIndex}
      defaultVariantIndex={sdkVariantIndex}
      onSetVariant={(variantIndex) => {
        onSetVariant(experience.id, variantIndex)
      }}
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
export function AudienceItem({
  audienceWithExperiences,
  onToggle,
  onSetVariant,
  onResetExperience,
  experienceOverrides,
  sdkVariantIndices,
  isExpanded: controlledExpanded,
  onToggleExpand,
}: AudienceItemProps): React.JSX.Element {
  const [localExpanded, setLocalExpanded] = useState(false)
  const isControlled = controlledExpanded !== undefined && onToggleExpand !== undefined
  const isExpanded = isControlled ? controlledExpanded : localExpanded
  const { audience, experiences, isQualified, isActive, overrideState } = audienceWithExperiences
  const maxHeightPerExperience = 1000
  const maxHeightValue = experiences.length * maxHeightPerExperience
  // Animation state
  const { current: animatedValue } = useRef(new Animated.Value(isExpanded ? 1 : 0))
  const [shouldRenderContent, setShouldRenderContent] = useState(isExpanded)

  useEffect(() => {
    if (isExpanded) {
      setShouldRenderContent(true)
    }

    Animated.timing(animatedValue, {
      toValue: isExpanded ? 1 : 0,
      duration: 250,
      useNativeDriver: false, // Height and opacity animations don't support native driver in standard Views
    }).start(({ finished }) => {
      if (finished && !isExpanded) {
        setShouldRenderContent(false)
      }
    })
  }, [isExpanded, animatedValue])

  const handleToggleExpand = useCallback((): void => {
    if (isControlled) {
      onToggleExpand()
    } else {
      setLocalExpanded((prev) => !prev)
    }
  }, [isControlled, onToggleExpand])

  const handleLongPress = useCallback((): void => {
    copyToClipboard(audience.id, 'Audience ID')
  }, [audience.id])

  // Interpolations for smooth transition
  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  })

  const maxHeight = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, maxHeightValue], // Large enough value to accommodate content
  })

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

      {shouldRenderContent && (
        <Animated.View style={[styles.experienceList, { opacity, maxHeight }]}>
          {experiences.length > 0 ? (
            experiences.map((exp) =>
              renderExperienceCard({
                experience: exp,
                experienceOverrides,
                sdkVariantIndices,
                isActive,
                handlers: { onSetVariant, onResetExperience },
              }),
            )
          ) : (
            <View style={styles.emptyExperiences}>
              <Text style={styles.emptyText}>No experiences target this audience</Text>
            </View>
          )}
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.secondary,
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
