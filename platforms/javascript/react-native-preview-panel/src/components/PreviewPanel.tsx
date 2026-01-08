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
import type { AudienceOverrideState, PreviewActions, PreviewPanelProps } from '../types'
import {
  createExperienceNameMap,
  enrichAudienceDefinitions,
  enrichExperienceDefinitions,
} from '../utils'
import { AudienceSection } from './AudienceSection'
import { OverridesSection } from './OverridesSection'
import { PersonalizationsSection } from './PersonalizationsSection'
import { ProfileSection } from './ProfileSection'
import { ActionButton, SearchBar } from './shared'

function applyAudienceOverride(
  audienceId: string,
  state: AudienceOverrideState,
  actions: PreviewActions,
): void {
  const actionMap: Record<AudienceOverrideState, () => void> = {
    on: () => {
      actions.activateAudience(audienceId)
    },
    off: () => {
      actions.deactivateAudience(audienceId)
    },
    default: () => {
      actions.resetAudienceOverride(audienceId)
    },
  }
  actionMap[state]()
}

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
 *         audienceDefinitions={audienceDefinitions}
 *         experienceDefinitions={experienceDefinitions}
 *         audienceEntries={audienceEntries}
 *         experienceEntries={experienceEntries}
 *       />
 *     </OptimizationProvider>
 *   )
 * }
 * ```
 */
// eslint-disable-next-line complexity -- Preview panel requires multiple hooks and conditional renders for full SDK state display
export function PreviewPanel({
  showHeader = true,
  style,
  onVisibilityChange,
  audienceDefinitions = [],
  experienceDefinitions = [],
  audienceEntries = [],
  experienceEntries = [],
  personalizationEntries = [],
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

  // Enrich definitions with Contentful entry data (names, descriptions)
  const enrichedAudienceDefinitions = useMemo(
    () => enrichAudienceDefinitions(audienceDefinitions, audienceEntries),
    [audienceDefinitions, audienceEntries],
  )

  const enrichedExperienceDefinitions = useMemo(
    () => enrichExperienceDefinitions(experienceDefinitions, experienceEntries),
    [experienceDefinitions, experienceEntries],
  )

  // Create name lookup map for personalizations section
  const experienceNames = useMemo(
    () => createExperienceNameMap(personalizationEntries),
    [personalizationEntries],
  )

  // Compute audiences with experiences using the new hook
  const { audiencesWithExperiences, hasData: hasDefinitions } = usePreviewData({
    audienceDefinitions: enrichedAudienceDefinitions,
    experienceDefinitions: enrichedExperienceDefinitions,
    previewState,
    overrides,
  })

  // Handle audience toggle changes
  const handleAudienceToggle = useCallback(
    (audienceId: string, state: AudienceOverrideState) => {
      logger.debug('[PreviewPanel] Audience toggle:', { audienceId, state })
      applyAudienceOverride(audienceId, state, actions)
    },
    [actions],
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
      'Reset SDK State',
      'This will reset the profile and all personalizations. Continue?',
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

        <PersonalizationsSection
          personalizations={personalizations}
          overrides={overrides.personalizations}
          onSetVariant={actions.setVariantOverride}
          onResetOverride={actions.resetPersonalizationOverride}
          experienceNames={experienceNames}
        />

        <OverridesSection
          overrides={overrides}
          onResetAll={actions.resetAllOverrides}
          onResetAudience={actions.resetAudienceOverride}
          onResetPersonalization={actions.resetPersonalizationOverride}
        />

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Footer */}
      <View style={commonStyles.footer}>
        <ActionButton
          label="Reset SDK State"
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
