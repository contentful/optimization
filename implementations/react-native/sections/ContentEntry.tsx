import React from 'react'
import { Text, View } from 'react-native'

import type Optimization from '@contentful/optimization-react-native'
import { Analytics, Personalization, ScrollProvider } from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'

import { RichTextRenderer, getRichTextContent } from '../components/RichTextRenderer'

interface ContentEntryProps {
  entry: Entry
  sdk: Optimization
}

function isNestedContentType(entry: Entry): boolean {
  return entry.sys.contentType.sys.id === 'nestedContent'
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

function isEntryArray(value: unknown): value is Entry[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false
  }
  const firstItem: unknown = value[0]
  if (typeof firstItem !== 'object' || firstItem === null || !('sys' in firstItem)) {
    return false
  }
  const { sys } = firstItem as { sys: unknown }
  if (typeof sys !== 'object' || sys === null || !('id' in sys)) {
    return false
  }
  return typeof (sys as { id: unknown }).id === 'string'
}

function getNestedEntries(fields: Entry['fields']): Entry[] | undefined {
  const { nested } = fields
  if (isEntryArray(nested)) {
    return nested
  }
  return undefined
}

function renderNestedContent(resolvedEntry: Entry): React.JSX.Element {
  const text =
    typeof resolvedEntry.fields.text === 'string' ? resolvedEntry.fields.text : 'No content'
  const fullLabel = `${text} [Entry: ${resolvedEntry.sys.id}]`

  const nestedEntries = getNestedEntries(resolvedEntry.fields)

  return (
    <View>
      <View testID={`entry-text-${resolvedEntry.sys.id}`} accessibilityLabel={fullLabel}>
        <Text>{text}</Text>
        <Text>{`[Entry: ${resolvedEntry.sys.id}]`}</Text>
      </View>
      {nestedEntries?.map((nestedEntry) => (
        <Personalization key={nestedEntry.sys.id} baselineEntry={nestedEntry}>
          {renderNestedContent}
        </Personalization>
      ))}
    </View>
  )
}

export function ContentEntry({ entry, sdk }: ContentEntryProps): React.JSX.Element {
  if (isNestedContentType(entry)) {
    return (
      <View testID={`nested-content-entry-${entry.sys.id}`}>
        <ScrollProvider>
          <Personalization baselineEntry={entry} testID={`nested-personalization-${entry.sys.id}`}>
            {renderNestedContent}
          </Personalization>
        </ScrollProvider>
      </View>
    )
  }

  const renderContent = (contentEntry: Entry, baselineId: string): React.JSX.Element => {
    const richTextField = Object.values(contentEntry.fields).find(isRichTextField)

    if (richTextField) {
      const textContent = getRichTextContent(richTextField, sdk)
      const fullLabel = `${textContent} [Entry: ${baselineId}]`

      return (
        <View testID={`entry-text-${baselineId}`} accessibilityLabel={fullLabel}>
          <RichTextRenderer richText={richTextField} sdk={sdk} />
          <Text>{`[Entry: ${baselineId}]`}</Text>
        </View>
      )
    }

    const text =
      typeof contentEntry.fields.text === 'string' ? contentEntry.fields.text : 'No content'
    const fullLabel = `${text} [Entry: ${baselineId}]`

    return (
      <View testID={`entry-text-${baselineId}`} accessibilityLabel={fullLabel}>
        <Text>{text}</Text>
        <Text>{`[Entry: ${baselineId}]`}</Text>
      </View>
    )
  }

  return (
    <View testID={`content-entry-${entry.sys.id}`}>
      <ScrollProvider>
        <Personalization baselineEntry={entry}>
          {(resolvedEntry) => (
            <Analytics entry={resolvedEntry}>
              <View testID={`content-${entry.sys.id}`}>
                {renderContent(resolvedEntry, entry.sys.id)}
              </View>
            </Analytics>
          )}
        </Personalization>
      </ScrollProvider>
    </View>
  )
}
