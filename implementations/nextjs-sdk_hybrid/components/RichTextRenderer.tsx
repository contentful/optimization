import type { RichTextDocument } from '@/lib/contentful'
import { isRecord } from '@/lib/util'
import { isMergeTagEntry, useMergeTagResolver } from '@contentful/optimization-nextjs/client'
import { documentToReactComponents, type Options } from '@contentful/rich-text-react-renderer'
import { INLINES } from '@contentful/rich-text-types'
import type { JSX } from 'react'

interface RichTextRendererProps {
  richText: RichTextDocument
}

type GetMergeTagValue = ReturnType<typeof useMergeTagResolver>['getMergeTagValue']

function isLink(target: unknown): target is { sys: { type: 'Link' } } {
  if (!isRecord(target) || !isRecord(target.sys)) {
    return false
  }

  return target.sys.type === 'Link'
}

function getMergeTagText(target: unknown, getMergeTagValue: GetMergeTagValue): string {
  if (isLink(target) || !isMergeTagEntry(target)) {
    return '[Merge Tag]'
  }

  return getMergeTagValue(target) ?? ''
}

export function RichTextRenderer({ richText }: RichTextRendererProps): JSX.Element {
  const { getMergeTagValue } = useMergeTagResolver()

  const renderOptions: Options = {
    renderNode: {
      [INLINES.EMBEDDED_ENTRY]: (node): string => {
        const { data } = node
        if (!isRecord(data) || !('target' in data)) {
          return '[Merge Tag]'
        }

        return getMergeTagText(data.target, getMergeTagValue)
      },
    },
  }

  return <>{documentToReactComponents(richText, renderOptions)}</>
}
