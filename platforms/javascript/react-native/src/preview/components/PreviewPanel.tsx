import { logger } from '@contentful/optimization-core'
import React, { useCallback, useEffect, useState } from 'react'
import { Alert, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native'
import { usePreviewOverrides } from '../context/PreviewOverrideContext'
import {
  useCollapsibleControl,
  useContentfulEntries,
  useDefinitions,
  usePreviewData,
  usePreviewState,
} from '../hooks'
import { commonStyles } from '../styles/common'
import { colors, spacing, typography } from '../styles/theme'
import type { AudienceOverrideState, ExperienceDefinition, PreviewPanelProps } from '../types'
import { OverridesSection } from './OverridesSection'
import { PreviewPanelContent } from './PreviewPanelContent'
import { ProfileSection } from './ProfileSection'
import { ActionButton, SearchBar } from './shared'

function formatConsentText(consent: boolean | undefined): string {
  if (consent === undefined) return '—'
  return consent ? 'Yes' : 'No'
}

function PreviewPanelHeader({ consent }: { consent: boolean | undefined }): React.JSX.Element {
  return (
    <View style={commonStyles.header}>
      <Text style={commonStyles.title}>Preview Panel</Text>
      <View style={styles.consentBadge}>
        <Text style={styles.consentText}>Consent: {formatConsentText(consent)}</Text>
      </View>
    </View>
  )
}

/**
 * Preview Panel for Contentful Optimization React Native SDK
 *
 * A comprehensive debugging interface that displays:
 * - Browsable list of audiences with human-readable names
 * - Three-state toggle for audience overrides (On/Off/Default)
 * - Experience cards with variant selection
 * - Search functionality for audiences and experiences
 * - Current profile information (ID, traits, audiences)
 * - Active personalizations with variant controls
 * - Override management with reset capabilities
 *
 * @example
 * ```tsx
 * import { OptimizationPreviewPanel, OptimizationProvider } from '@contentful/optimization-react-native'
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
 *       <OptimizationPreviewPanel contentfulClient={contentfulClient} />
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

  // Get overrides from context (provided by PreviewOverrideProvider via PreviewPanelOverlay)
  // Throws an error if used outside of PreviewPanelOverlay
  const { overrides, actions } = usePreviewOverrides()

  // Contentful entries state (using custom hook)
  const {
    audienceEntries,
    experienceEntries,
    isLoading: entriesLoading,
    error: entriesError,
  } = useContentfulEntries(contentfulClient)

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

  // Create definitions and name maps from Contentful entries
  const { audienceDefinitions, experienceDefinitions, audienceNames, experienceNames } =
    useDefinitions(audienceEntries, experienceEntries)

  // Compute audiences with experiences using the new hook
  const {
    audiencesWithExperiences,
    hasData: hasDefinitions,
    sdkVariantIndices,
  } = usePreviewData({
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

      switch (state) {
        case 'on':
          actions.activateAudience(audienceId, getExperiencesForAudience(audienceId))
          break
        case 'off':
          actions.deactivateAudience(audienceId, getExperiencesForAudience(audienceId))
          break
        case 'default':
          actions.resetAudienceOverride(audienceId)
          break
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
      {showHeader && <PreviewPanelHeader consent={consent} />}

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
        <PreviewPanelContent
          isLoading={entriesLoading}
          error={entriesError}
          hasDefinitions={hasDefinitions}
          audiencesWithExperiences={audiencesWithExperiences}
          onAudienceToggle={handleAudienceToggle}
          onSetVariant={actions.setVariantOverride}
          onResetExperience={actions.resetPersonalizationOverride}
          experienceOverrides={overrides.personalizations}
          sdkVariantIndices={sdkVariantIndices}
          searchQuery={searchQuery}
          isAudienceExpanded={isCollapsibleOpen}
          onToggleAudienceExpand={toggleCollapsible}
          onToggleAllExpand={toggleAllCollapsibles}
          allExpanded={allCollapsiblesOpen}
          initializeCollapsible={initializeCollapsible}
        />

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
