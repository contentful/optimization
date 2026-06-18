import { CAN_ADD_LISTENERS } from '../../../constants'
import {
  collectAffectedDisplayContentsStates,
  syncDisplayContentsMutationObserver,
  syncVirtualMeasurementListeners,
} from './displayContentsViewLifecycle'
import {
  type RootMargin,
  isDisplayContentsElement,
  measureVirtualVisibility,
  parseRootMargin,
  resolveObservationSource,
} from './displayContentsViewSource'
import {
  type EffectiveObserverOptions,
  type ElementState,
  NOW,
  derefElement,
} from './element-view-observer-support'

type ScheduledTask =
  | {
      readonly frame: false
      readonly id: ReturnType<typeof setTimeout>
    }
  | {
      readonly frame: true
      readonly id: number
    }

interface ElementViewSourceControllerHandlers {
  readonly onDropped: (state: ElementState) => void
  readonly onHidden: (state: ElementState, now: number) => void
  readonly onVisible: (state: ElementState, now: number) => void
  readonly sweep: () => void
}

class ElementViewSourceController {
  private readonly rootMargin: RootMargin
  private readonly io: IntersectionObserver
  private readonly opts: EffectiveObserverOptions
  private readonly handlers: ElementViewSourceControllerHandlers
  private readonly targetStates = new WeakMap<Element, Set<ElementState>>()
  private readonly displayContentsStates = new Set<ElementState>()
  private readonly virtualStates = new Set<ElementState>()
  private cleanupVirtualListeners?: () => void
  private mutationObserver?: MutationObserver
  private virtualMeasureTask: ScheduledTask | null = null

  public constructor(
    io: IntersectionObserver,
    opts: EffectiveObserverOptions,
    handlers: ElementViewSourceControllerHandlers,
  ) {
    this.io = io
    this.opts = opts
    this.handlers = handlers
    this.rootMargin = parseRootMargin(opts.rootMargin)
  }

  public apply(state: ElementState, resetVisibility: boolean): void {
    const element = derefElement(state)

    if (!element) {
      this.handlers.onDropped(state)
      return
    }

    const next = resolveObservationSource(element)
    const sourceChanged = state.source !== next.source || state.target !== next.target

    if (!sourceChanged) {
      if (state.source === 'virtual') this.scheduleVirtualMeasurement()
      return
    }

    if (resetVisibility && state.lastKnownVisible) {
      this.handlers.onHidden(state, NOW())
    }

    this.removeSource(state)

    const { source, target } = next
    state.source = source
    state.target = target

    if (isDisplayContentsElement(element)) {
      this.displayContentsStates.add(state)
    }

    if (next.source === 'virtual') {
      this.virtualStates.add(state)
      this.scheduleVirtualMeasurement()
    } else if (next.target) {
      this.observeTarget(next.target, state)
    }

    this.syncMutationObserver()
    this.syncVirtualListeners()
  }

  public remove(state: ElementState): void {
    this.removeSource(state)
    this.syncMutationObserver()
    this.syncVirtualListeners()
  }

  public getStatesForTarget(target: Element): ReadonlySet<ElementState> | undefined {
    return this.targetStates.get(target)
  }

  public requestVirtualMeasurement(): void {
    this.scheduleVirtualMeasurement()
  }

  public disconnect(): void {
    this.cancelVirtualMeasurement()
    this.displayContentsStates.clear()
    this.virtualStates.clear()
    this.mutationObserver?.disconnect()
    this.mutationObserver = undefined
    this.cleanupVirtualListeners?.()
    this.cleanupVirtualListeners = undefined
  }

  private removeSource(state: ElementState): void {
    if (state.target) {
      this.unobserveTarget(state.target, state)
      state.target = null
    }

    this.virtualStates.delete(state)
    this.displayContentsStates.delete(state)
  }

  private observeTarget(target: Element, state: ElementState): void {
    let states = this.targetStates.get(target)

    if (!states) {
      states = new Set<ElementState>()
      this.targetStates.set(target, states)
      this.io.observe(target)
    }

    states.add(state)
  }

  private unobserveTarget(target: Element, state: ElementState): void {
    const states = this.targetStates.get(target)
    if (!states) return

    states.delete(state)

    if (states.size > 0) return

    this.targetStates.delete(target)
    this.io.unobserve(target)
  }

  private scheduleVirtualMeasurement(): void {
    if (this.virtualMeasureTask !== null || this.virtualStates.size === 0) return

    if (CAN_ADD_LISTENERS && typeof requestAnimationFrame === 'function') {
      const id = requestAnimationFrame(() => {
        this.virtualMeasureTask = null
        this.measureVirtualStates()
      })
      this.virtualMeasureTask = { frame: true, id }
      return
    }

    const id = setTimeout(() => {
      this.virtualMeasureTask = null
      this.measureVirtualStates()
    }, 0)
    this.virtualMeasureTask = { frame: false, id }
  }

  private cancelVirtualMeasurement(): void {
    const { virtualMeasureTask } = this
    if (!virtualMeasureTask) return

    if (virtualMeasureTask.frame) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(virtualMeasureTask.id)
    } else {
      clearTimeout(virtualMeasureTask.id)
    }

    this.virtualMeasureTask = null
  }

  private measureVirtualStates(): void {
    if (this.virtualStates.size === 0) return

    const now = NOW()

    for (const state of this.virtualStates) {
      if (state.done || state.source !== 'virtual') continue

      const element = derefElement(state)

      if (!element) {
        this.handlers.onDropped(state)
        continue
      }

      const visible = measureVirtualVisibility(element, {
        minVisibleRatio: this.opts.minVisibleRatio,
        root: this.opts.root,
        rootMargin: this.rootMargin,
      })

      if (visible) {
        this.handlers.onVisible(state, now)
      } else {
        this.handlers.onHidden(state, now)
      }
    }

    this.handlers.sweep()
  }

  private syncMutationObserver(): void {
    this.mutationObserver = syncDisplayContentsMutationObserver(
      this.mutationObserver,
      this.displayContentsStates,
      this.onDisplayContentsMutations.bind(this),
    )
  }

  private onDisplayContentsMutations(records: readonly MutationRecord[]): void {
    if (records.length === 0 || this.displayContentsStates.size === 0) return

    collectAffectedDisplayContentsStates(records, this.displayContentsStates).forEach((state) => {
      this.apply(state, true)
    })
  }

  private syncVirtualListeners(): void {
    this.cleanupVirtualListeners = syncVirtualMeasurementListeners(
      this.cleanupVirtualListeners,
      this.virtualStates.size > 0,
      this.scheduleVirtualMeasurement.bind(this),
      this.cancelVirtualMeasurement.bind(this),
    )
  }
}

export default ElementViewSourceController
