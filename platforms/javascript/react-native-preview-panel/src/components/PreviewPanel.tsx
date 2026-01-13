import { logger } from '@contentful/optimization-core'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import {
  useCollapsibleControl,
  usePreviewData,
  usePreviewState,
  useProfileOverrides,
} from '../hooks'
import { commonStyles } from '../styles/common'
import { colors, spacing, typography } from '../styles/theme'
import type {
  AudienceOverrideState,
  ContentfulEntry,
  ExperienceDefinition,
  PreviewPanelProps,
} from '../types'
import {
  createAudienceDefinitions,
  createExperienceDefinitions,
  fetchAudienceAndExperienceEntries,
} from '../utils'
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
 * import { createClient } from 'contentful'
 *
 * const contentfulClient = createClient({
 *   space: 'your-space-id',
 *   accessToken: 'your-access-token',
 * })
 *
 * function App() {
 *   return (
 *     <OptimizationProvider instance={sdk}>
 *       <YourAppContent />
 *       <PreviewPanel contentfulClient={contentfulClient} />
 *     </OptimizationProvider>
 *   )
 * }
 * ```
 */

export function PreviewPanel({
  showHeader = true,
  style,
  onVisibilityChange,
  contentfulClient,
}: PreviewPanelProps): React.JSX.Element {
  const previewState = usePreviewState()
  const { profile, personalizations, consent, isLoading } = previewState
  const { overrides, actions } = useProfileOverrides()

  // Contentful entries state
  const [audienceEntries, setAudienceEntries] = useState<ContentfulEntry[]>([])
  const [experienceEntries, setExperienceEntries] = useState<ContentfulEntry[]>([])
  const [entriesLoading, setEntriesLoading] = useState(true)
  const [entriesError, setEntriesError] = useState<string | null>(null)

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

  // Fetch Contentful entries on mount with pagination
  useEffect(() => {
    async function fetchContentfulEntries(): Promise<void> {
      setEntriesLoading(true)
      setEntriesError(null)

      try {
        const { audiences, experiences } = await fetchAudienceAndExperienceEntries(contentfulClient)
        setAudienceEntries(audiences)
        setExperienceEntries(experiences)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        logger.error('[PreviewPanel] Failed to fetch entries:', errorMessage)
        setEntriesError(errorMessage)
      } finally {
        setEntriesLoading(false)
      }
    }

    void fetchContentfulEntries()
  }, [contentfulClient])

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

      {/* Search Bar - only show if we have definitions and not loading */}
      {!entriesLoading && hasDefinitions && (
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
        {/* Loading state for entries */}
        {entriesLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent.primary} />
            <Text style={styles.loadingText}>Loading audiences and experiences...</Text>
          </View>
        )}

        {/* Error state for entries */}
        {entriesError && !entriesLoading && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Failed to load entries</Text>
            <Text style={styles.errorText}>{entriesError}</Text>
          </View>
        )}

        {/* Audience & Experience Browser - show if definitions are provided and not loading */}
        {!entriesLoading && !entriesError && hasDefinitions && (
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

export default PreviewPanel
