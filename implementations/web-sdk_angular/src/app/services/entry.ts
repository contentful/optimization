import {
  afterNextRender,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  TransferState,
  untracked,
  type Signal,
} from '@angular/core'

import { isMergeTagEntry, type MergeTagEntry } from '@contentful/optimization-web/api-schemas'
import type { Document, Text } from '@contentful/rich-text-types'
import { INLINES } from '@contentful/rich-text-types'
import type { Entry } from 'contentful'
import { SERVER_RESOLVED_ENTRIES_KEY } from '../transfer-state-keys'
import { isRecord } from '../utils'
import { NgContentfulOptimization } from './optimization'

export type ObservationMode = 'auto' | 'manual'

type MergeTagResolver = (target: MergeTagEntry) => string | undefined

export interface ResolvedEntry {
  entry: Entry
  baselineId: string
  entryId: string
  optimizationId: string | undefined
  sticky: boolean | undefined
  variantIndex: number | undefined
  mergeTagResolved: boolean | undefined
}

function isRichTextDocument(value: unknown): value is Document {
  return isRecord(value) && value.nodeType === 'document'
}

function resolveNode(node: unknown, resolveMergeTag: MergeTagResolver): unknown {
  if (!isRecord(node)) return node
  const { data } = node
  if (node.nodeType === INLINES.EMBEDDED_ENTRY && isRecord(data)) {
    const { target } = data
    if (isMergeTagEntry(target)) {
      return {
        nodeType: 'text',
        value: resolveMergeTag(target) ?? '',
        marks: [],
        data: {},
      } satisfies Text
    }
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

function setupManualTracking(result: Signal<ResolvedEntry>, manualTracking: Signal<boolean>): void {
  const optimization = inject(NgContentfulOptimization)
  const elementRef = inject<ElementRef<Element>>(ElementRef)
  const destroyRef = inject(DestroyRef)

  const domReady = signal(false)

  afterNextRender(() => {
    domReady.set(true)
  })

  function track(): void {
    const { sdk } = optimization
    if (!sdk) return
    const { entryId, optimizationId, sticky, variantIndex } = result()
    sdk.tracking.enableElement('views', elementRef.nativeElement, {
      data: { entryId, optimizationId, sticky, variantIndex },
    })
  }

  function clear(): void {
    const { sdk } = optimization
    if (!sdk) return
    sdk.tracking.clearElement('views', elementRef.nativeElement)
  }

  effect(() => {
    clear()
    if (domReady() && manualTracking()) {
      track()
    }
  })

  destroyRef.onDestroy(clear)
}

export function injectContentfulEntry({
  entry,
  isLive = signal(false),
  manualTracking = signal(false),
}: {
  entry: Signal<Entry>
  isLive?: Signal<boolean>
  manualTracking?: Signal<boolean>
}): Signal<ResolvedEntry> {
  const optimization = inject(NgContentfulOptimization)
  const transferState = inject(TransferState)

  function liveRead<T>(sig: Signal<T>): T {
    if (isLive()) return sig()
    // untracked(sig) would snapshot undefined before the SDK responds, permanently
    // freezing the computed. The tracked fallback keeps reactivity alive only until
    // the first real value arrives; after that untracked(sig) is non-null and the
    // reactive dependency is never taken.
    return untracked(sig) ?? sig()
  }

  const variant = computed(() => {
    const raw = entry()
    const { sdk } = optimization
    if (sdk) {
      return {
        raw,
        resolved: sdk.resolveOptimizedEntry(raw, liveRead(optimization.selectedOptimizations)),
      }
    }
    // Server render: lift the server-resolved entry from TransferState if present
    // so the initial HTML reflects the personalized variant. Falls back to the
    // baseline when no handoff exists (e.g. consent denied — server skipped resolve).
    const handoff = transferState.get(SERVER_RESOLVED_ENTRIES_KEY, undefined)
    const slot = handoff?.[raw.sys.id]
    return {
      raw,
      resolved: {
        entry: slot?.resolvedEntry ?? raw,
        selectedOptimization: slot?.selectedOptimization ?? undefined,
      },
    }
  })

  const result = computed(() => {
    const { raw, resolved } = variant()
    const profile = liveRead(optimization.profile)
    const { sdk } = optimization
    let mergeTagResolved: boolean | undefined = undefined
    const entry = resolveEntryMergeTags(resolved.entry, (target) => {
      const value = sdk && profile ? sdk.getMergeTagValue(target, profile) : undefined
      if (value !== undefined) mergeTagResolved = true
      else mergeTagResolved ??= false
      return value ?? target.fields.nt_fallback
    })

    return {
      entry,
      baselineId: raw.sys.id,
      entryId: resolved.entry.sys.id,
      optimizationId: resolved.selectedOptimization?.experienceId,
      sticky: resolved.selectedOptimization?.sticky,
      variantIndex: resolved.selectedOptimization?.variantIndex,
      mergeTagResolved,
    }
  })

  setupManualTracking(result, manualTracking)

  return result
}
