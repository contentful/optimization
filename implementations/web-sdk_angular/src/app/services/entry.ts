import {
  afterNextRender,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  type Signal,
} from '@angular/core'

import type { MergeTagEntry } from '@contentful/optimization-web/api-schemas'
import type { Document, Text } from '@contentful/rich-text-types'
import { INLINES } from '@contentful/rich-text-types'
import type { Entry } from 'contentful'
import { isRecord } from '../utils'
import { NgContentfulOptimization } from './optimization'

export type ObservationMode = 'auto' | 'manual'

type MergeTagResolver = (target: MergeTagEntry) => string | undefined

export interface ResolvedEntryView {
  resolvedEntry: Entry
  baselineId: string
  resolvedId: string
  experienceId: string | undefined
  sticky: boolean | undefined
  variantIndex: number | undefined
  mergeTagResolved: boolean | undefined
}

function isMergeTagEntry(entry: unknown): entry is MergeTagEntry {
  if (!isRecord(entry) || !isRecord(entry.sys)) return false
  if (!isRecord(entry.sys.contentType)) return false
  if (!isRecord(entry.sys.contentType.sys)) return false
  return entry.sys.contentType.sys.id === 'nt_mergetag'
}

function isRichTextDocument(value: unknown): value is Document {
  return isRecord(value) && value.nodeType === 'document' && Array.isArray(value.content)
}

function resolveNode(node: unknown, resolveMergeTag: MergeTagResolver): unknown {
  if (!isRecord(node)) return node
  if (
    node.nodeType === INLINES.EMBEDDED_ENTRY &&
    isRecord(node.data) &&
    isMergeTagEntry(node.data.target)
  ) {
    return {
      nodeType: 'text',
      value: resolveMergeTag(node.data.target) ?? '',
      marks: [],
      data: {},
    } satisfies Text
  }
  if (Array.isArray(node.content)) {
    return { ...node, content: node.content.map((child) => resolveNode(child, resolveMergeTag)) }
  }
  return node
}

function resolveEntryMergeTags(entry: Entry, resolveMergeTag: MergeTagResolver): Entry {
  return Object.assign({}, entry, {
    fields: Object.fromEntries(
      Object.entries(entry.fields).map(([key, value]) => [
        key,
        isRichTextDocument(value) ? resolveNode(value, resolveMergeTag) : value,
      ]),
    ),
  }) as Entry
}

export function injectContentfulEntry({
  entry,
  isLive = signal(false),
  observation = signal<ObservationMode>('auto'),
}: {
  entry: Signal<Entry>
  isLive?: Signal<boolean>
  observation?: Signal<ObservationMode>
}): Signal<ResolvedEntryView | undefined> {
  const optimization = inject(NgContentfulOptimization)
  const elementRef = inject<ElementRef<Element>>(ElementRef)
  const destroyRef = inject(DestroyRef)

  const domReady = signal(false)
  let manualTrackingActive = false

  afterNextRender(() => {
    domReady.set(true)
  })

  function liveRead<T>(sig: Signal<T>): T {
    return isLive() ? sig() : untracked(sig)
  }

  const variant = computed(() => {
    const raw = entry()
    return {
      raw,
      resolved: optimization.sdk.resolveOptimizedEntry(
        raw,
        liveRead(optimization.selectedOptimizations),
      ),
    }
  })

  const result = computed(() => {
    const { raw, resolved } = variant()
    const profile = liveRead(optimization.profile)
    let mergeTagResolved: boolean | undefined = undefined
    const resolvedEntry = resolveEntryMergeTags(resolved.entry, (target) => {
      const value = profile ? optimization.sdk.getMergeTagValue(target, profile) : undefined
      if (value !== undefined) mergeTagResolved = true
      else mergeTagResolved ??= false
      return value ?? target.fields.nt_fallback
    })

    return {
      resolvedEntry,
      baselineId: raw.sys.id,
      resolvedId: resolved.entry.sys.id,
      experienceId: resolved.selectedOptimization?.experienceId,
      sticky: resolved.selectedOptimization?.sticky,
      variantIndex: resolved.selectedOptimization?.variantIndex,
      mergeTagResolved,
    }
  })

  function enableManualTracking(r: ResolvedEntryView): void {
    optimization.sdk.tracking.enableElement('views', elementRef.nativeElement, {
      data: {
        entryId: r.resolvedId,
        optimizationId: r.experienceId,
        sticky: r.sticky,
        variantIndex: r.variantIndex,
      },
    })
    manualTrackingActive = true
  }

  function clearManualTracking(): void {
    if (manualTrackingActive) {
      optimization.sdk.tracking.clearElement('views', elementRef.nativeElement)
      manualTrackingActive = false
    }
  }

  effect(() => {
    clearManualTracking()
    if (!domReady() || observation() === 'auto') return
    enableManualTracking(result())
  })

  destroyRef.onDestroy(() => {
    clearManualTracking()
  })

  return result
}
