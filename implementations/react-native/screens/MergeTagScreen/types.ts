/**
 * Type definitions for MergeTagScreen
 */

import type Optimization from '@contentful/optimization-react-native'
import type { MergeTagEntry } from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'

export interface ThemeColors {
  backgroundColor: string
  cardBackground: string
  textColor: string
  mutedTextColor: string
  successColor: string
  errorColor: string
  accentColor: string
}

export interface MergeTagScreenProps {
  colors: ThemeColors
  onBack: () => void
  sdk: Optimization
  mergeTagEntry: Entry
}

export interface RichTextNode {
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

export interface RichTextField {
  nodeType: 'document'
  content: RichTextNode[]
  data: Record<string, unknown>
}

export interface EmbeddedEntryNode {
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

export interface TextNode {
  nodeType: string
  value: string
}

export function isRichTextField(field: unknown): field is RichTextField {
  return (
    typeof field === 'object' &&
    field !== null &&
    'nodeType' in field &&
    (field as { nodeType: unknown }).nodeType === 'document' &&
    'content' in field &&
    Array.isArray((field as { content: unknown }).content)
  )
}

export interface EntryWithIncludes extends Entry {
  includes?: {
    Entry?: Entry[]
  }
}

export function isMergeTagEntry(entry: Entry): entry is MergeTagEntry {
  return entry.sys.contentType.sys.id === 'nt_mergetag'
}
