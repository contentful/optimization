import React, { useEffect } from 'react'
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'

import type Optimization from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'

import { RichTextRenderer } from '../components/RichTextRenderer'

interface MergeTagScreenProps {
  sdk: Optimization
  mergeTagEntry: Entry
}

interface RichTextNode {
  nodeType: string
  data?: unknown
  content?: RichTextNode[]
  value?: string
}

interface RichTextField {
  nodeType: 'document'
  content: RichTextNode[]
}

interface EntryWithIncludes extends Entry {
  includes?: {
    Entry?: Entry[]
  }
}

function isRichTextField(field: unknown): field is RichTextField {
  return (
    typeof field === 'object' &&
    field !== null &&
    'nodeType' in field &&
    (field as { nodeType: unknown }).nodeType === 'document' &&
    'content' in field &&
    Array.isArray((field as { content: unknown }).content)
  )
}

export function MergeTagScreen({ sdk, mergeTagEntry }: MergeTagScreenProps): React.JSX.Element {
  useEffect(() => {
    void sdk.personalization.page({ properties: { url: 'merge-tags' } })
  }, [sdk])

  const richTextField = Object.values(mergeTagEntry.fields).find(isRichTextField)
  const entryWithIncludes = mergeTagEntry as EntryWithIncludes

  if (!richTextField) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>No rich text field found</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.textContainer}>
          <RichTextRenderer
            richText={richTextField}
            sdk={sdk}
            includes={entryWithIncludes.includes}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  textContainer: {
    marginVertical: 8,
  },
})
