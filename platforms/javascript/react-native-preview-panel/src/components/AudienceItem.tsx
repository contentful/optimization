import Clipboard from '@react-native-clipboard/clipboard'
import React, { useCallback, useState } from 'react'
import {
  Alert,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native'
import { borderRadius, colors, spacing, typography } from '../styles/theme'
import type { AudienceItemProps, ExperienceDefinition, PersonalizationOverride } from '../types'
import { ExperienceCard } from './ExperienceCard'
import { AudienceToggle, QualificationIndicator } from './shared'

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const copyToClipboard = (text: string, label: string): void => {
  Clipboard.setString(text)
  Alert.alert('Copied', `${label} copied to clipboard`)
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

/** Header component for AudienceItem */
const AudienceItemHeader = ({
  audience,
  experiences,
  isExpanded,
  isQualified,
  overrideState,
  onToggleExpand,
  onLongPress,
  onToggle,
}: {
  audience: { id: string; name: string; description?: string }
  experiences: ExperienceDefinition[]
  isExpanded: boolean
  isQualified: boolean
  overrideState: 'on' | 'off' | 'default'
  onToggleExpand: () => void
  onLongPress: () => void
  onToggle: (state: 'on' | 'off' | 'default') => void
}): React.JSX.Element => (
  <View style={styles.header}>
    <TouchableOpacity
      style={styles.headerLeft}
      onPress={onToggleExpand}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
      <View style={styles.audienceInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.audienceName} numberOfLines={isExpanded ? undefined : 2}>
            {audience.name}
          </Text>
          {isQualified && <QualificationIndicator style={styles.qualificationBadge} />}
        </View>
        {audience.description ? (
          <Text style={styles.audienceDescription} numberOfLines={isExpanded ? undefined : 1}>
            {audience.description}
          </Text>
        ) : null}
        <Text style={styles.experienceCount}>
          {experiences.length} experience{experiences.length !== 1 ? 's' : ''}
        </Text>
      </View>
    </TouchableOpacity>
    <View style={styles.headerRight}>
      <AudienceToggle value={overrideState} onValueChange={onToggle} audienceId={audience.id} />
    </View>
  </View>
)

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.secondary, // gray-50 to match web panel
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headerRight: {
    flexShrink: 0,
  },
  expandIcon: {
    fontSize: typography.fontSize.xl,
    color: colors.text.primary,
    marginTop: 3, // Align with text baseline
    width: 20,
    height: 20,
  },
  audienceInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  audienceName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    flexShrink: 1,
  },
  qualificationBadge: {
    marginTop: 1,
  },
  audienceDescription: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  experienceCount: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
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
