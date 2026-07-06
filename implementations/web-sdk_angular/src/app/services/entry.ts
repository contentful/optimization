import { isPlatformBrowser } from '@angular/common'
import {
  afterNextRender,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  PLATFORM_ID,
  signal,
  untracked,
  type Signal,
} from '@angular/core'

import type { Entry } from 'contentful'
import { resolveEntryMergeTags } from './merge-tags'
import { NgContentfulOptimization } from './optimization'

export type ObservationMode = 'auto' | 'manual'

export interface ResolvedEntry {
  entry: Entry
  baselineId: string
  entryId: string
  optimizationId: string | undefined
  sticky: boolean | undefined
  variantIndex: number | undefined
  mergeTagResolved: boolean | undefined
}

function setupManualTracking(result: Signal<ResolvedEntry>, manualTracking: Signal<boolean>): void {
  // `sdk.tracking.*` is a browser-only imperative API — the server has no DOM
  // element to observe. Gating the whole wiring on `isPlatformBrowser` mirrors
  // how React Web puts tracking inside `useEffect`: the lifecycle itself is
  // the "if browser" guard, so the calls below never need a runtime check.
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return

  const { liveSdk } = inject(NgContentfulOptimization)
  if (!liveSdk) return
  const { tracking } = liveSdk
  const elementRef = inject<ElementRef<Element>>(ElementRef)
  const destroyRef = inject(DestroyRef)

  const domReady = signal(false)

  afterNextRender(() => {
    domReady.set(true)
  })

  function track(): void {
    const { entryId, optimizationId, sticky, variantIndex } = result()
    tracking.enableElement('views', elementRef.nativeElement, {
      data: { entryId, optimizationId, sticky, variantIndex },
    })
  }

  function clear(): void {
    tracking.clearElement('views', elementRef.nativeElement)
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

  function liveRead<T>(sig: Signal<T>): T {
    if (isLive()) return sig()
    // untracked(sig) would snapshot undefined before the SDK responds, permanently
    // freezing the computed. The tracked fallback keeps reactivity alive only until
    // the first real value arrives; after that untracked(sig) is non-null and the
    // reactive dependency is never taken.
    return untracked(sig) ?? sig()
  }

  const result = computed(() => {
    const runtime = optimization.runtime()
    const raw = entry()
    const resolved = runtime.resolveOptimizedEntry(
      raw,
      liveRead(optimization.selectedOptimizations),
    )
    const profile = liveRead(optimization.profile)
    let mergeTagResolved: boolean | undefined = undefined
    const entryWithMergeTags = resolveEntryMergeTags(resolved.entry, (target) => {
      const value = profile ? runtime.getMergeTagValue(target, profile) : undefined
      if (value !== undefined) mergeTagResolved = true
      else mergeTagResolved ??= false
      return value ?? target.fields.nt_fallback
    })

    return {
      entry: entryWithMergeTags,
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
