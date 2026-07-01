import { type createNextjsOptimization } from '@contentful/optimization-nextjs/server'
import { INLINES } from '@contentful/rich-text-types'
import { appConfig } from './config'
import type { ContentEntry, RichTextDocument } from './contentful'

type MergeTagEntry = Parameters<ReturnType<typeof createNextjsOptimization>['getMergeTagValue']>[0]

export function setAppConsent(consented: boolean): void {
  const value = consented ? 'granted' : 'denied'
  document.cookie = `${appConfig.personalizationConsentCookie}=${value}; Path=/; SameSite=Lax`
}

export function getAppConsent(cookies: { get(i: string): { value: string } | undefined }): boolean {
  return cookies.get(appConfig.personalizationConsentCookie)?.value === 'granted'
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isEntry(value: unknown): value is ContentEntry {
  return (
    isRecord(value) &&
    isRecord(value.sys) &&
    typeof value.sys.id === 'string' &&
    isRecord(value.fields)
  )
}

export function isRichTextField(field: unknown): field is RichTextDocument {
  return isRecord(field) && field.nodeType === 'document' && Array.isArray(field.content)
}

export function isMergeTagNode(
  node: unknown,
): node is Record<string, unknown> & { data: Record<string, unknown> & { target: MergeTagEntry } } {
  return (
    isRecord(node) &&
    node.nodeType === INLINES.EMBEDDED_ENTRY &&
    isRecord(node.data) &&
    'target' in node.data
  )
}
