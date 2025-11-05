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

import type Optimization from '@contentful/optimization-react-native'
import type { MergeTagEntry, Profile } from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'

interface ThemeColors {
  backgroundColor: string
  cardBackground: string
  textColor: string
  mutedTextColor: string
  successColor: string
  errorColor: string
  accentColor: string
}

interface MergeTagScreenProps {
  colors: ThemeColors
  onBack: () => void
  sdk: Optimization
  mergeTagEntry: Entry
}

interface RichTextNode {
  nodeType: string
  data?: {
    target?: {
      sys?: {
        id?: string
        type?: string
        linkType?: string
      }
    }
  }
  content?: RichTextNode[]
}

interface RichTextField {
  nodeType: string
  content?: RichTextNode[]
}

interface EmbeddedEntryNode {
  nodeType: string
  data: {
    target: {
      sys: {
        id: string
        type: string
        linkType: string
      }
    }
  }
}

function findMergeTagEntries(
  fragment: RichTextField | RichTextNode,
  mergeTagEntries: EmbeddedEntryNode[] = [],
): EmbeddedEntryNode[] {
  if (!fragment.content) return mergeTagEntries

  const embeddedEntries = fragment.content.filter(
    (item): item is EmbeddedEntryNode =>
      item.nodeType.startsWith('embedded') &&
      'data' in item &&
      item.data?.target?.sys?.id !== undefined,
  )

  mergeTagEntries.push(...embeddedEntries)

  fragment.content
    .filter((item): item is RichTextNode => 'content' in item && Array.isArray(item.content))
    .forEach((item) => findMergeTagEntries(item, mergeTagEntries))

  return mergeTagEntries
}

interface TextNode {
  nodeType: string
  value: string
}

function isTextNode(item: unknown): item is TextNode {
  return (
    typeof item === 'object' &&
    item !== null &&
    'nodeType' in item &&
    'value' in item &&
    typeof (item as { value: unknown }).value === 'string'
  )
}

function extractTextFromRichText(node: RichTextField | RichTextNode): string {
  if (!node.content) return ''

  return node.content
    .map((item) => {
      if (item.nodeType === 'text' && isTextNode(item)) {
        return item.value
      }
      if (item.nodeType.startsWith('embedded')) {
        return '[MERGE TAG]'
      }
      if ('content' in item) {
        return extractTextFromRichText(item)
      }
      return ''
    })
    .join('')
}

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
    const richTextField = Object.values(fields).find((field): field is RichTextField => {
      if (typeof field !== 'object' || field === null || !('nodeType' in field)) {
        return false
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Checking nodeType property dynamically
      const fieldWithNodeType = field as { nodeType: unknown }
      return (
        typeof fieldWithNodeType.nodeType === 'string' && fieldWithNodeType.nodeType === 'document'
      )
    })

    if (richTextField && profile) {
      const embeddedNodes = findMergeTagEntries(richTextField)

      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Contentful Entry includes are not strictly typed
      const entryWithIncludes = mergeTagEntry as { includes?: { Entry?: Entry[] } }
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

        if (includedEntry && includedEntry.sys.contentType.sys.id === 'nt_mergetag') {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Validated by contentType check
          const mergeTagEntry = includedEntry as MergeTagEntry
          mergeTagEntriesList.push(mergeTagEntry)

          const resolvedValue = sdk.personalization.getMergeTagValue(mergeTagEntry, profile)
          const mergeTagFields = mergeTagEntry.fields as { nt_mergetag_id: string }
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

  const richTextField = Object.values(mergeTagEntry.fields).find(
    (field): field is RichTextField => {
      if (typeof field !== 'object' || field === null || !('nodeType' in field)) {
        return false
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Checking nodeType property dynamically
      const fieldWithNodeType = field as { nodeType: unknown }
      return (
        typeof fieldWithNodeType.nodeType === 'string' && fieldWithNodeType.nodeType === 'document'
      )
    },
  )

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
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.cardTitle, { color: colors.textColor }]}>About Merge Tags</Text>
          <Text style={[styles.cardText, { color: colors.mutedTextColor }]}>
            Merge tags allow you to embed personalized data from the user profile directly into
            Contentful content. They resolve dynamically based on the current visitor's profile.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.cardTitle, { color: colors.textColor }]}>Original Text</Text>
          <Text style={[styles.codeText, { color: colors.mutedTextColor }]}>{originalText}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.accentColor }]}>
          <Text style={[styles.cardTitle, { color: '#ffffff' }]}>Resolved Text</Text>
          <Text style={[styles.resolvedText, { color: '#ffffff' }]}>{resolvedText}</Text>
        </View>

        {mergeTagDetails.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.cardTitle, { color: colors.textColor }]}>Merge Tag Details</Text>
            {mergeTagDetails.map((mergeTag, index) => {
              const tagFields = mergeTag.fields as {
                nt_name: string
                nt_mergetag_id: string
                nt_fallback?: string
              }
              return (
                <View key={index} style={styles.detailSection}>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.mutedTextColor }]}>
                      Name:
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.textColor }]}>
                      {tagFields.nt_name}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.mutedTextColor }]}>
                      Path:
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.textColor }]}>
                      {tagFields.nt_mergetag_id}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.mutedTextColor }]}>
                      Fallback:
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.textColor }]}>
                      {tagFields.nt_fallback ?? 'None'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.mutedTextColor }]}>
                      Resolved Value:
                    </Text>
                    <Text style={[styles.resolvedValue, { color: colors.successColor }]}>
                      {resolvedValues[index]?.value?.toString() ?? 'N/A'}
                    </Text>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {profile ? (
          <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.cardTitle, { color: colors.textColor }]}>
              Current Profile Data
            </Text>
            <View style={styles.detailSection}>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.mutedTextColor }]}>
                  Profile ID:
                </Text>
                <Text
                  style={[styles.detailValue, { color: colors.textColor }]}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {profile.id}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.mutedTextColor }]}>
                  Continent:
                </Text>
                <Text style={[styles.detailValue, { color: colors.textColor }]}>
                  {profile.location.continent}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.mutedTextColor }]}>City:</Text>
                <Text style={[styles.detailValue, { color: colors.textColor }]}>
                  {profile.location.city}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.mutedTextColor }]}>Country:</Text>
                <Text style={[styles.detailValue, { color: colors.textColor }]}>
                  {profile.location.countryCode}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.cardTitle, { color: colors.textColor }]}>How It Works</Text>
          <Text style={[styles.cardText, { color: colors.mutedTextColor }]}>
            1. Contentful entry contains embedded merge tag entry{'\n'}
            2. Merge tag specifies a path in the profile (e.g., "location.continent"){'\n'}
            3. SDK resolves the value from the current user profile{'\n'}
            4. If the value exists, it's used; otherwise, fallback is returned{'\n'}
            5. The resolved value is displayed in place of the merge tag
          </Text>
        </View>

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
  card: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  cardText: {
    fontSize: 14,
    lineHeight: 22,
  },
  codeText: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'monospace',
  },
  resolvedText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  detailSection: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    width: 120,
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
    fontFamily: 'monospace',
  },
  resolvedValue: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  bottomSpacer: {
    height: 40,
  },
})
