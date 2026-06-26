import { createScopedLogger } from '@contentful/optimization-core/logger'
import React, { useCallback, useEffect, useState } from 'react'
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
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

const logger = createScopedLogger('RN:Preview')

/** @internal */
function formatConsentText(consent: boolean | undefined): string {
  if (consent === undefined) return '—'
  return consent ? 'Yes' : 'No'
}

/** @internal */
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
 * Comprehensive debugging interface for the Optimization React Native SDK.
 *
 * Displays audiences, experiences, variant selectors, profile information,
 * and override management controls.
 *
 * @param props - Component props
 * @returns The rendered preview panel
 *
 * @remarks
 * Must be used within a `PreviewOverrideProvider`. Prefer
 * {@link PreviewPanelOverlay}, which supplies that provider and modal chrome.
 *
 * @example
 * ```tsx
 * import { OptimizationRoot } from '@contentful/optimization-react-native'
 * import { PreviewPanelOverlay } from '@contentful/optimization-react-native/preview'
 * import { createClient } from 'contentful'
 *
 * const contentfulClient = createClient({
 *   space: 'your-space-id',
 *   accessToken: 'your-access-token',
 * })
 *
 * function App() {
 *   return (
 *     <OptimizationRoot clientId="your-client-id" environment="main">
 *       <YourAppContent />
 *       <PreviewPanelOverlay contentfulClient={contentfulClient} />
 *     </OptimizationRoot>
 *   )
 * }
 * ```
 *
 * @public
 */

export function PreviewPanel({
  showHeader = true,
  style,
  onVisibilityChange,
  contentfulClient,
  onRefresh,
}: PreviewPanelProps): React.JSX.Element {
  const previewState = usePreviewState()
  const { profile, selectedOptimizations, consent, isLoading } = previewState

  // Get overrides from context (provided by PreviewPanelOverlay).
  // Throws an error if used outside of PreviewOverrideProvider.
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

  // Inline reset confirmation state. Replaces a UIAlertController/AlertDialog
  // so the confirm/cancel buttons live inside the panel's Modal hierarchy and
  // are reachable by Detox on iOS.
  const [isConfirmingReset, setIsConfirmingReset] = useState(false)

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
      logger.debug('Audience toggle:', { audienceId, state })

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
    logger.info('Panel mounted')
    onVisibilityChange?.(true)

    return () => {
      logger.info('Panel unmounted')
      onVisibilityChange?.(false)
    }
  }, [onVisibilityChange])

  // Log state changes
  useEffect(() => {
    logger.debug('State updated:', {
      profileId: profile?.id,
      selectedOptimizationsCount: selectedOptimizations?.length ?? 0,
      consent,
      overridesCount:
        Object.keys(overrides.audiences).length +
        Object.keys(overrides.selectedOptimizations).length,
    })
  }, [profile, selectedOptimizations, consent, overrides])

  const handleResetSdkPress = (): void => {
    setIsConfirmingReset(true)
  }

  const handleResetCancel = (): void => {
    setIsConfirmingReset(false)
  }

  const handleResetConfirm = (): void => {
    setIsConfirmingReset(false)
    actions.resetSdkState()
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
      <ScrollView
        testID="preview-panel-scroll"
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <PreviewPanelContent
          isLoading={entriesLoading}
          error={entriesError}
          hasDefinitions={hasDefinitions}
          audiencesWithExperiences={audiencesWithExperiences}
          onAudienceToggle={handleAudienceToggle}
          onSetVariant={actions.setVariantOverride}
          onResetExperience={actions.resetOptimizationOverride}
          experienceOverrides={overrides.selectedOptimizations}
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
          onResetOptimization={actions.resetOptimizationOverride}
          audienceNames={audienceNames}
          experienceNames={experienceNames}
        />

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Footer */}
      <View style={commonStyles.footer}>
        {isConfirmingReset ? (
          <View style={styles.resetConfirm} testID="reset-all-confirm-prompt">
            <Text style={styles.resetConfirmText}>
              This will clear all manual overrides and restore the SDK state to the values last
              received from the API. Continue?
            </Text>
            <View style={styles.resetConfirmButtons}>
              <ActionButton
                label="Cancel"
                variant="secondary"
                onPress={handleResetCancel}
                style={styles.resetConfirmButton}
                testID="reset-all-cancel"
              />
              <ActionButton
                label="Reset"
                variant="destructive"
                onPress={handleResetConfirm}
                style={styles.resetConfirmButton}
                testID="reset-all-confirm"
              />
            </View>
          </View>
        ) : (
          <>
            {onRefresh && (
              <ActionButton
                label="Refresh"
                variant="secondary"
                onPress={onRefresh}
                style={styles.refreshButton}
                testID="preview-refresh-button"
              />
            )}
            <ActionButton
              label="Reset to Actual State"
              variant="destructive"
              onPress={handleResetSdkPress}
              style={styles.resetButton}
              testID="reset-all-overrides"
            />
          </>
        )}
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
  refreshButton: {
    width: '100%',
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  resetConfirm: {
    width: '100%',
    gap: spacing.md,
  },
  resetConfirmText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  resetConfirmButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  resetConfirmButton: {
    flex: 1,
    paddingVertical: spacing.md,
  },
})

export default PreviewPanel
