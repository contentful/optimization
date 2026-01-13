import { logger } from '@contentful/optimization-core'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native'
import {
  useCollapsibleControl,
  usePreviewData,
  usePreviewState,
  useProfileOverrides,
} from '../hooks'
import { commonStyles } from '../styles/common'
import { colors, spacing, typography } from '../styles/theme'
import type { AudienceOverrideState, ExperienceDefinition, PreviewPanelProps } from '../types'
import { createAudienceDefinitions, createExperienceDefinitions } from '../utils'
import { AudienceSection } from './AudienceSection'
import { OverridesSection } from './OverridesSection'
import { ProfileSection } from './ProfileSection'
import { ActionButton, SearchBar } from './shared'

/**
 * Preview Panel for Contentful Optimization React Native SDK
 *
 * A comprehensive debugging interface that displays:
 * - Browsable list of audiences with human-readable names
 * - Three-state toggle for audience overrides (On/Off/Auto)
 * - Experience cards with variant selection
 * - Search functionality for audiences and experiences
 * - Current profile information (ID, traits, audiences)
 * - Active personalizations with variant controls
 * - Override management with reset capabilities
 *
 * @example
 * ```tsx
 * import { PreviewPanel } from '@contentful/optimization-react-native-preview-panel'
 *
 * function App() {
 *   return (
 *     <OptimizationProvider instance={sdk}>
 *       <YourAppContent />
 *       <PreviewPanel
 *         audienceEntries={audienceEntries}
 *         experienceEntries={experienceEntries}
 *         personalizationEntries={personalizationEntries}
 *       />
 *     </OptimizationProvider>
 *   )
 * }
 * ```
 */

export function PreviewPanel({
  showHeader = true,
  style,
  onVisibilityChange,
  audienceEntries = [],
  experienceEntries = [],
}: PreviewPanelProps): React.JSX.Element {
  const previewState = usePreviewState()
  const { profile, personalizations, consent, isLoading } = previewState
  const { overrides, actions } = useProfileOverrides()

  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  // Collapsible control for expand/collapse all
  const {
    toggleCollapsible,
    toggleAllCollapsibles,
    isCollapsibleOpen,
    allCollapsiblesOpen,
    initializeCollapsible,
  } = useCollapsibleControl({ initiallyOpen: false })

  // Create definitions from Contentful entries
  const audienceDefinitions = useMemo(
    () => createAudienceDefinitions(audienceEntries),
    [audienceEntries],
  )

  const experienceDefinitions = useMemo(
    () => createExperienceDefinitions(experienceEntries),
    [experienceEntries],
  )

  // Create name maps for display in OverridesSection
  const audienceNames = useMemo(
    () =>
      audienceDefinitions.reduce<Record<string, string>>((acc, audience) => {
        const { id, name } = audience
        acc[id] = name
        return acc
      }, {}),
    [audienceDefinitions],
  )

  const experienceNames = useMemo(
    () =>
      experienceDefinitions.reduce<Record<string, string>>((acc, experience) => {
        const { id, name } = experience
        acc[id] = name
        return acc
      }, {}),
    [experienceDefinitions],
  )

  // Compute audiences with experiences using the new hook
  const { audiencesWithExperiences, hasData: hasDefinitions } = usePreviewData({
    audienceDefinitions,
    experienceDefinitions,
    previewState,
    overrides,
  })

  const getExperiencesForAudience = useCallback(
    (audienceId: string): ExperienceDefinition[] => {
      const audienceData = audiencesWithExperiences.find((a) => a.audience.id === audienceId)
      return audienceData?.experiences ?? []
    },
    [audiencesWithExperiences],
  )

  // Handle audience toggle changes
  const handleAudienceToggle = useCallback(
    (audienceId: string, state: AudienceOverrideState) => {
      logger.debug('[PreviewPanel] Audience toggle:', { audienceId, state })
      const experiences = getExperiencesForAudience(audienceId)

      if (state === 'on') {
        actions.activateAudience(audienceId)
        experiences.forEach((exp) => {
          actions.setVariantOverride(exp.id, 1) // Show first personalized variant
        })
      } else if (state === 'off') {
        actions.deactivateAudience(audienceId)
        experiences.forEach((exp) => {
          actions.setVariantOverride(exp.id, 0) // Show baseline
        })
      } else {
        // 'default' - reset to API values
        actions.resetAudienceOverride(audienceId)
        experiences.forEach((exp) => {
          actions.resetPersonalizationOverride(exp.id)
        })
      }
    },
    [actions, getExperiencesForAudience],
  )

  // Notify visibility change on mount/unmount
  useEffect(() => {
    logger.info('[PreviewPanel] Panel mounted')
    onVisibilityChange?.(true)

    return () => {
      logger.info('[PreviewPanel] Panel unmounted')
      onVisibilityChange?.(false)
    }
  }, [onVisibilityChange])

  // Log state changes
  useEffect(() => {
    logger.debug('[PreviewPanel] State updated:', {
      profileId: profile?.id,
      personalizationsCount: personalizations?.length ?? 0,
      consent,
      overridesCount:
        Object.keys(overrides.audiences).length + Object.keys(overrides.personalizations).length,
    })
  }, [profile, personalizations, consent, overrides])

  const handleResetSdk = (): void => {
    Alert.alert(
      'Reset to Actual State',
      'This will clear all manual overrides and restore the SDK state to the values last received from the API. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: actions.resetSdkState },
      ],
    )
  }

  return (
    <SafeAreaView style={[commonStyles.container, style]}>
      <StatusBar barStyle="dark-content" />
      {/* Header */}
      {showHeader && (
        <View style={commonStyles.header}>
          <Text style={commonStyles.title}>Preview Panel</Text>
          <View style={styles.consentBadge}>
            <Text style={styles.consentText}>
              Consent: {consent === undefined ? '—' : consent ? 'Yes' : 'No'}
            </Text>
          </View>
        </View>
      )}

      {/* Search Bar - only show if we have definitions */}
      {hasDefinitions && (
        <View style={styles.searchContainer}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search audiences and experiences..."
          />
        </View>
      )}

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Audience & Experience Browser - show if definitions are provided */}
        {hasDefinitions && (
          <AudienceSection
            audiencesWithExperiences={audiencesWithExperiences}
            onAudienceToggle={handleAudienceToggle}
            onSetVariant={actions.setVariantOverride}
            onResetExperience={actions.resetPersonalizationOverride}
            experienceOverrides={overrides.personalizations}
            searchQuery={searchQuery}
            isAudienceExpanded={isCollapsibleOpen}
            onToggleAudienceExpand={toggleCollapsible}
            onToggleAllExpand={toggleAllCollapsibles}
            allExpanded={allCollapsiblesOpen}
            initializeCollapsible={initializeCollapsible}
          />
        )}

        <ProfileSection profile={profile} isLoading={isLoading} />

        <OverridesSection
          overrides={overrides}
          onResetAudience={actions.resetAudienceOverride}
          onResetPersonalization={actions.resetPersonalizationOverride}
          audienceNames={audienceNames}
          experienceNames={experienceNames}
        />

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Footer */}
      <View style={commonStyles.footer}>
        <ActionButton
          label="Reset to Actual State"
          variant="destructive"
          onPress={handleResetSdk}
          style={styles.resetButton}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
  },
  consentBadge: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 4,
  },
  consentText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  bottomSpacer: {
    height: spacing.xl,
  },
  resetButton: {
    width: '100%',
    paddingVertical: spacing.md,
  },
})

export default PreviewPanel
