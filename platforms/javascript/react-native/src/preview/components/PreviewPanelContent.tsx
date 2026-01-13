import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { colors, spacing, typography } from '../styles/theme'
import type {
  AudienceOverrideState,
  AudienceWithExperiences,
  PersonalizationOverride,
} from '../types'
import { AudienceSection } from './AudienceSection'

interface PreviewPanelContentProps {
  isLoading: boolean
  error: string | null
  hasDefinitions: boolean
  audiencesWithExperiences: AudienceWithExperiences[]
  onAudienceToggle: (audienceId: string, state: AudienceOverrideState) => void
  onSetVariant: (experienceId: string, variantIndex: number) => void
  onResetExperience: (experienceId: string) => void
  experienceOverrides: Record<string, PersonalizationOverride>
  sdkVariantIndices: Record<string, number>
  searchQuery: string
  isAudienceExpanded: (audienceId: string) => boolean
  onToggleAudienceExpand: (audienceId: string) => void
  onToggleAllExpand: () => void
  allExpanded: boolean
  initializeCollapsible: (audienceId: string) => void
}

export function PreviewPanelContent({
  isLoading,
  error,
  hasDefinitions,
  audiencesWithExperiences,
  onAudienceToggle,
  onSetVariant,
  onResetExperience,
  experienceOverrides,
  sdkVariantIndices,
  searchQuery,
  isAudienceExpanded,
  onToggleAudienceExpand,
  onToggleAllExpand,
  allExpanded,
  initializeCollapsible,
}: PreviewPanelContentProps): React.JSX.Element | null {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent.primary} />
        <Text style={styles.loadingText}>Loading audiences and experiences...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Failed to load entries</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )
  }

  if (!hasDefinitions) {
    return null
  }

  return (
    <AudienceSection
      audiencesWithExperiences={audiencesWithExperiences}
      onAudienceToggle={onAudienceToggle}
      onSetVariant={onSetVariant}
      onResetExperience={onResetExperience}
      experienceOverrides={experienceOverrides}
      sdkVariantIndices={sdkVariantIndices}
      searchQuery={searchQuery}
      isAudienceExpanded={isAudienceExpanded}
      onToggleAudienceExpand={onToggleAudienceExpand}
      onToggleAllExpand={onToggleAllExpand}
      allExpanded={allExpanded}
      initializeCollapsible={initializeCollapsible}
    />
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
  },
  errorContainer: {
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.action.destructive,
  },
  errorTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.action.destructive,
    marginBottom: spacing.xs,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
})
