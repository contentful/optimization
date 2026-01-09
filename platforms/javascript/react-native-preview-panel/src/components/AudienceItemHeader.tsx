import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors, spacing, typography } from '../styles/theme'
import type { ExperienceDefinition } from '../types'
import { AudienceToggle, QualificationIndicator } from './shared'

interface AudienceItemHeaderProps {
  audience: { id: string; name: string; description?: string }
  experiences: ExperienceDefinition[]
  isExpanded: boolean
  isQualified: boolean
  overrideState: 'on' | 'off' | 'default'
  onToggleExpand: () => void
  onLongPress: () => void
  onToggle: (state: 'on' | 'off' | 'default') => void
}

/** Header component for AudienceItem */
export function AudienceItemHeader({
  audience,
  experiences,
  isExpanded,
  isQualified,
  overrideState,
  onToggleExpand,
  onLongPress,
  onToggle,
}: AudienceItemHeaderProps): React.JSX.Element {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onToggleExpand} onLongPress={onLongPress} activeOpacity={0.7}>
        <View style={styles.nameRow}>
          <Text style={styles.audienceName} numberOfLines={isExpanded ? undefined : 2}>
            {audience.name}
          </Text>
          {isQualified && <QualificationIndicator style={styles.qualificationBadge} />}
        </View>
      </TouchableOpacity>

      <View style={styles.headerMain}>
        <TouchableOpacity
          style={styles.headerLeft}
          onPress={onToggleExpand}
          onLongPress={onLongPress}
          activeOpacity={0.7}
        >
          <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
          <View style={styles.audienceInfo}>
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
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'column',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
})

export default AudienceItemHeader
