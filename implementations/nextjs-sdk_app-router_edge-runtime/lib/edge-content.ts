import type { SelectedOptimizationArray } from '@contentful/optimization-nextjs/api-schemas'
import { isResolvedContentfulEntry } from '@contentful/optimization-nextjs/api-schemas'
import { appConfig } from './config'

interface EntryCollection {
  readonly items?: unknown
  readonly includes?: { readonly Entry?: unknown }
}

export interface EdgeRenderedEntry {
  readonly text: string
  readonly trackingAttributes: {
    readonly 'data-ctfl-baseline-id': string
    readonly 'data-ctfl-entry-id': string
    readonly 'data-ctfl-optimization-id': string | undefined
    readonly 'data-ctfl-variant-index': string
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function loadEntryCollection(baselineId: string, locale: string): Promise<EntryCollection> {
  const url = new URL(
    `spaces/${appConfig.spaceId}/environments/${appConfig.environment}/entries`,
    appConfig.contentful.baseUrl,
  )
  url.searchParams.set('sys.id', baselineId)
  url.searchParams.set('include', '10')
  url.searchParams.set('locale', locale)

  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${appConfig.contentful.accessToken}` },
  })
  if (!response.ok) throw new Error(`Contentful entry request failed: ${response.status}`)

  const value: unknown = await response.json()
  if (!isRecord(value)) throw new TypeError('Contentful entry response is not an object.')
  return value
}

function findEntry(collection: EntryCollection, entryId: string) {
  const included = isRecord(collection.includes) ? collection.includes.Entry : undefined
  const candidates = [
    ...(Array.isArray(collection.items) ? collection.items : []),
    ...(Array.isArray(included) ? included : []),
  ]
  const entry = candidates.find(
    (candidate) => isResolvedContentfulEntry(candidate) && candidate.sys.id === entryId,
  )
  if (!isResolvedContentfulEntry(entry)) {
    throw new Error(`Contentful entry ${entryId} is missing from the selected baseline response.`)
  }
  return entry
}

export async function loadEdgeRenderedEntry({
  baselineId,
  locale,
  selectedOptimizations,
}: {
  readonly baselineId: string
  readonly locale: string
  readonly selectedOptimizations: SelectedOptimizationArray | undefined
}): Promise<EdgeRenderedEntry> {
  const collection = await loadEntryCollection(baselineId, locale)
  findEntry(collection, baselineId)
  const selectedOptimization = selectedOptimizations?.find((selection) =>
    Object.prototype.hasOwnProperty.call(selection.variants, baselineId),
  )
  const selectedId = selectedOptimization?.variants[baselineId] ?? baselineId
  const selected = findEntry(collection, selectedId)
  const text = selected.fields.text

  if (typeof text !== 'string') {
    throw new TypeError(`Contentful entry ${selectedId} has no plain text field.`)
  }

  return {
    text,
    trackingAttributes: {
      'data-ctfl-baseline-id': baselineId,
      'data-ctfl-entry-id': selectedId,
      'data-ctfl-optimization-id': selectedOptimization?.experienceId,
      'data-ctfl-variant-index': String(selectedOptimization?.variantIndex ?? 0),
    },
  }
}
