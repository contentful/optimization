import {
  afterNextRender,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  type Signal,
} from '@angular/core'

import type { Entry } from 'contentful'
import { NgContentfulOptimization } from './optimization'

export type ObservationMode = 'auto' | 'manual'

export interface ResolvedEntry {
  entry: Entry
  baselineId: string
  entryId: string
  isEmptyVariant: boolean
  optimizationId: string | undefined
  sticky: boolean | undefined
  variantIndex: number | undefined
}

function setupManualTracking(result: Signal<ResolvedEntry>, manualTracking: Signal<boolean>): void {
  // `runtime().tracking.*` is a NOOP on the server snapshot runtime and the
  // real web SDK after hydration, so the wiring below can run unconditionally.
  // `afterNextRender` already guards DOM access — it never fires on the server.
  const optimization = inject(NgContentfulOptimization)
  const elementRef = inject<ElementRef<Element>>(ElementRef)
  const destroyRef = inject(DestroyRef)

  const domReady = signal(false)

  afterNextRender(() => {
    domReady.set(true)
  })

  function track(): void {
    const { entryId, optimizationId, sticky, variantIndex } = result()
    optimization.runtime().tracking.enableElement('views', elementRef.nativeElement, {
      data: { entryId, optimizationId, sticky, variantIndex },
    })
  }

  function clear(): void {
    optimization.runtime().tracking.clearElement('views', elementRef.nativeElement)
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

  const result = computed<ResolvedEntry>(() => {
    const live = isLive()
    const runtime = live ? optimization.runtime() : optimization.presentationRuntime()
    const raw = entry()
    const resolved = runtime.resolveOptimizedEntry(
      raw,
      live ? optimization.selectedOptimizations() : runtime.states.selectedOptimizations.current,
    )

    return {
      entry: resolved.entry,
      baselineId: raw.sys.id,
      entryId: resolved.entry.sys.id,
      isEmptyVariant: resolved.isEmptyVariant === true,
      optimizationId: resolved.selectedOptimization?.experienceId,
      sticky: resolved.selectedOptimization?.sticky,
      variantIndex: resolved.selectedOptimization?.variantIndex,
    }
  })

  setupManualTracking(result, manualTracking)

  return result
}
