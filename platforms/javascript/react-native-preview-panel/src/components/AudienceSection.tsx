import React, { useEffect, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { commonStyles } from '../styles/common'
import { spacing } from '../styles/theme'
import type { AudienceSectionProps, AudienceWithExperiences } from '../types'
import { AudienceItem } from './AudienceItem'
import { CollapseToggleButton, Section } from './shared'

/**
 * Filters audiences based on search query.
 * Matches against audience name and experience names.
 */
const filterAudiences = (
  audiences: AudienceWithExperiences[],
  query: string,
): AudienceWithExperiences[] => {
  if (!query.trim()) {
    return audiences
  }

  const lowerQuery = query.toLowerCase().trim()

  return audiences.filter((item) => {
    // Match audience name
    if (item.audience.name.toLowerCase().includes(lowerQuery)) {
      return true
    }

    // Match audience description
    if (item.audience.description?.toLowerCase().includes(lowerQuery)) {
      return true
    }

    // Match any experience name
    return item.experiences.some((exp) => exp.name.toLowerCase().includes(lowerQuery))
  })
}

/**
 * Section component displaying all audiences with their experiences.
 *
 * Features:
 * - Searchable list of audiences
 * - Each audience can be expanded to show experiences
 * - Collapse All / Expand All button
 * - Toggle controls for audience overrides
 * - Empty state when no audiences match search
 */
export const AudienceSection = ({
  audiencesWithExperiences,
  onAudienceToggle,
  onSetVariant,
  onResetExperience,
  experienceOverrides,
  searchQuery = '',
  isAudienceExpanded,
  onToggleAudienceExpand,
  onToggleAllExpand,
  allExpanded = false,
  initializeCollapsible,
}: AudienceSectionProps): React.JSX.Element => {
  // Filter audiences based on search query
  const filteredAudiences = useMemo(
    () => filterAudiences(audiencesWithExperiences, searchQuery),
    [audiencesWithExperiences, searchQuery],
  )

  // Sort audiences: qualified first, then alphabetically
  const sortedAudiences = useMemo(
    () =>
      [...filteredAudiences].sort((a, b) => {
        // Qualified audiences first
        if (a.isQualified && !b.isQualified) return -1
        if (!a.isQualified && b.isQualified) return 1

        // Then by name
        return a.audience.name.localeCompare(b.audience.name)
      }),
    [filteredAudiences],
  )

  // Initialize collapsibles when audiences change
  useEffect(() => {
    if (initializeCollapsible) {
      sortedAudiences.forEach((item) => {
        initializeCollapsible(item.audience.id)
      })
    }
  }, [sortedAudiences, initializeCollapsible])

  // Check if collapsible control is enabled
  const hasCollapsibleControl =
    isAudienceExpanded !== undefined &&
    onToggleAudienceExpand !== undefined &&
    onToggleAllExpand !== undefined

  if (audiencesWithExperiences.length === 0) {
    return (
      <Section title="Audiences & Experiences">
        <View style={styles.emptyContainer}>
          <Text style={commonStyles.emptyText}>
            No audience or experience definitions provided.
          </Text>
          <Text style={styles.emptyHint}>
            Pass audienceDefinitions and experienceDefinitions props to enable the audience browser.
          </Text>
        </View>
      </Section>
    )
  }

  if (sortedAudiences.length === 0 && searchQuery) {
    return (
      <Section title="Audiences & Experiences">
        <View style={styles.emptyContainer}>
          <Text style={commonStyles.emptyText}>No results found for "{searchQuery}"</Text>
          <Text style={styles.emptyHint}>Try a different search term</Text>
        </View>
      </Section>
    )
  }

  return (
    <Section title={`Audiences & Experiences (${sortedAudiences.length})`}>
      {/* Collapse/Expand All Button */}
      {hasCollapsibleControl && sortedAudiences.length > 1 && (
        <View style={styles.collapseToggleContainer}>
          <CollapseToggleButton allExpanded={allExpanded} onToggle={onToggleAllExpand} />
        </View>
      )}

      <View style={styles.audienceList}>
        {sortedAudiences.map((audienceWithExperiences) => (
          <AudienceItem
            key={audienceWithExperiences.audience.id}
            audienceWithExperiences={audienceWithExperiences}
            onToggle={(state) => {
              onAudienceToggle(audienceWithExperiences.audience.id, state)
            }}
            onSetVariant={onSetVariant}
            onResetExperience={onResetExperience}
            experienceOverrides={experienceOverrides}
            isExpanded={
              hasCollapsibleControl
                ? isAudienceExpanded(audienceWithExperiences.audience.id)
                : undefined
            }
            onToggleExpand={
              hasCollapsibleControl
                ? () => {
                    onToggleAudienceExpand(audienceWithExperiences.audience.id)
                  }
                : undefined
            }
          />
        ))}
      </View>
    </Section>
  )
}

const styles = StyleSheet.create({
  collapseToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: spacing.sm,
  },
  audienceList: {
    gap: spacing.sm,
  },
  emptyContainer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyHint: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
})

export default AudienceSection
