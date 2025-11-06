/**
 * Type definitions for MergeTagScreen
 */

import type Optimization from '@contentful/optimization-react-native'
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
  nodeType: string
  content?: RichTextNode[]
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

