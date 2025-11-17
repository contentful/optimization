import React, { useEffect } from 'react'
import { Text, View } from 'react-native'

import type Optimization from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'

import { RichTextRenderer } from '../components/RichTextRenderer'

interface MergeTagSectionProps {
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

export function MergeTagSection({ sdk, mergeTagEntry }: MergeTagSectionProps): React.JSX.Element {
  useEffect(() => {
    void sdk.personalization.page({ properties: { url: 'merge-tags' } })
  }, [sdk])

  const richTextField = Object.values(mergeTagEntry.fields).find(isRichTextField)

  if (!richTextField) {
    return <Text testID="merge-tag-error">No rich text field found</Text>
  }

  return (
    <View testID="merge-tag-section">
      <View testID="merge-tag-content">
        <RichTextRenderer richText={richTextField} sdk={sdk} />
      </View>
    </View>
  )
}
