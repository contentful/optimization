/**
 * Merge Tag Test Screen - Demonstrates merge tag resolution functionality
 *
 * This screen shows how merge tags embedded in Contentful rich text fields
 * are resolved using the current user profile data.
 */

import React, { useEffect, useState } from 'react'
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native'

import type { MergeTagEntry, Profile } from '@contentful/optimization-react-native'

import { InfoCard } from './components/InfoCard'
import { MergeTagDetailCard } from './components/MergeTagDetailCard'
import { ProfileCard } from './components/ProfileCard'
import { TextDisplayCard } from './components/TextDisplayCard'
import type { EntryWithIncludes, MergeTagScreenProps } from './types'
import { isMergeTagEntry, isRichTextField } from './types'
import { extractTextFromRichText, findMergeTagEntries } from './utils/richTextUtils'

export function MergeTagScreen({
  colors,
  onBack,
  sdk,
  mergeTagEntry,
}: MergeTagScreenProps): React.JSX.Element {
  const [profile, setProfile] = useState<Profile | undefined>(undefined)
  const [resolvedValues, setResolvedValues] = useState<Array<{ id: string; value: unknown }>>([])
  const [mergeTagDetails, setMergeTagDetails] = useState<MergeTagEntry[]>([])

  useEffect(() => {
    void sdk.personalization.page({ url: 'merge-tags-demo' })
  }, [sdk])

  useEffect(() => {
    const subscription = sdk.states.profile.subscribe((currentProfile) => {
      setProfile(currentProfile)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [sdk])

  useEffect(() => {
    const { fields } = mergeTagEntry
    const richTextField = Object.values(fields).find(isRichTextField)

    if (richTextField && profile) {
      const embeddedNodes = findMergeTagEntries(richTextField)

      const entryWithIncludes = mergeTagEntry as EntryWithIncludes
      const { includes } = entryWithIncludes
      const includedEntries = includes?.Entry ?? []

      const mergeTagEntriesList: MergeTagEntry[] = []
      const resolvedValuesList: Array<{ id: string; value: unknown }> = []

      embeddedNodes.forEach((node) => {
        const { data } = node
        const { target } = data
        const { sys } = target
        const { id: targetId } = sys
        const includedEntry = includedEntries.find((entry) => entry.sys.id === targetId)

        if (includedEntry && isMergeTagEntry(includedEntry)) {
          mergeTagEntriesList.push(includedEntry)

          const resolvedValue = sdk.personalization.getMergeTagValue(includedEntry, profile)
          const mergeTagFields = includedEntry.fields as {
            nt_mergetag_id: string
          }
          resolvedValuesList.push({
            id: mergeTagFields.nt_mergetag_id,
            value: resolvedValue,
          })
        }
      })

      setMergeTagDetails(mergeTagEntriesList)
      setResolvedValues(resolvedValuesList)
    }
  }, [mergeTagEntry, sdk, profile])

  const richTextField = Object.values(mergeTagEntry.fields).find(isRichTextField)

  const originalText = richTextField ? extractTextFromRichText(richTextField) : ''
  const resolvedText = originalText.replace(
    /\[MERGE TAG\]/g,
    () => resolvedValues[0]?.value?.toString() ?? '[NOT RESOLVED]',
  )

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundColor }]}>
      <StatusBar barStyle={useColorScheme() === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { borderBottomColor: colors.mutedTextColor }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} testID="backButton">
          <Text style={[styles.backButtonText, { color: colors.successColor }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textColor }]}>Merge Tags Demo</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <InfoCard
          title="About Merge Tags"
          content="Merge tags allow you to embed personalized data from the user profile directly into Contentful content. They resolve dynamically based on the current visitor's profile."
          colors={colors}
        />

        <TextDisplayCard title="Original Text" content={originalText} colors={colors} monospace />

        <TextDisplayCard
          title="Resolved Text"
          content={resolvedText}
          colors={colors}
          accentBackground
        />

        <MergeTagDetailCard
          mergeTagDetails={mergeTagDetails}
          resolvedValues={resolvedValues}
          colors={colors}
        />

        <ProfileCard profile={profile} colors={colors} />

        <InfoCard
          title="How It Works"
          content={`1. Contentful entry contains embedded merge tag entry
2. Merge tag specifies a path in the profile (e.g., "location.continent")
3. SDK resolves the value from the current user profile
4. If the value exists, it's used; otherwise, fallback is returned
5. The resolved value is displayed in place of the merge tag`}
          colors={colors}
        />

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 16,
  },
  scrollContent: {
    padding: 16,
  },
  bottomSpacer: {
    height: 40,
  },
})
