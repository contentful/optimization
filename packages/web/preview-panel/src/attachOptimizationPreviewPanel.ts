import type ContentfulOptimization from '@contentful/optimization-web'
import type {
  AudienceEntrySkeleton,
  ChangeArray,
  OptimizationData,
  OptimizationEntry,
  OptimizationEntrySkeleton,
  SelectedOptimizationArray,
} from '@contentful/optimization-web/api-schemas'
import type {
  PreviewPanelSignalObject,
  SignalFns,
  Signals,
} from '@contentful/optimization-web/core-sdk'
import {
  PREVIEW_PANEL_SIGNALS_SYMBOL,
  PREVIEW_PANEL_SIGNAL_FNS_SYMBOL,
} from '@contentful/optimization-web/symbols'
import type { ChainModifiers, ContentfulClientApi, Entry } from 'contentful'
import {
  AUDIENCE_SWITCH_CHANGE,
  OPTIMIZATION_CHANGE,
  defineAudience,
  isAudience,
  isAudienceSwitchChangeEvent,
} from './components/audience'
import { defineAudienceSwitch } from './components/audience-switch'
import { defineAudiences } from './components/audiences'
import { defineIndicator } from './components/indicator'
import { defineMatchedText } from './components/matched-text'
import { defineOptimization, isRecordRadioGroupChangeEvent } from './components/optimization'
import {
  PANEL_DRAWER_TOGGLE,
  PANEL_RESET,
  PANEL_TAG,
  definePanel,
  isDrawerToggleEvent,
  isPanel,
} from './components/panel'
import { defineSearch } from './components/search'
import { getAllEntries, isAudienceEntry, isOptimizationEntry } from './lib/entries'
import { applyChangeOverrides, applyOptimizationOverrides } from './lib/overrides'
import { isChange, isSelectedOptimization } from './lib/schemaGuards'
import { createScopedLogger } from './logger'

declare global {
  interface Window {
    /** Global nonce value used by the Lit framework */
    litNonce?: string
    /** Global OptimizationPreviewPanel class constructor. */
    attachOptimizationPreviewPanel?: typeof attachOptimizationPreviewPanel
  }
}

/** @internal */
let defaults: {
  selectedOptimizations?: SelectedOptimizationArray
  changes?: ChangeArray
} = {}

/** @internal */
const overrides = new Map<string, number>()
const OVERRIDES_STORAGE_KEY = '__ctfl_opt_preview_overrides__'
const DEFAULTS_STORAGE_KEY = '__ctfl_opt_preview_defaults__'
const storageLogger = createScopedLogger('PreviewPanelStorage')

/** @internal */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** @internal */
function loadOverrides(): void {
  overrides.clear()

  try {
    const stored = localStorage.getItem(OVERRIDES_STORAGE_KEY)
    if (!stored) return

    const parsed = JSON.parse(stored) as unknown
    if (!isRecord(parsed)) return

    for (const [experienceId, variantIndex] of Object.entries(parsed)) {
      if (typeof variantIndex === 'number') overrides.set(experienceId, variantIndex)
    }
  } catch (error) {
    storageLogger.warn(`Failed to read localStorage key "${OVERRIDES_STORAGE_KEY}"`, error)
  }
}

/** @internal */
function loadDefaults(): void {
  defaults = {}

  try {
    const stored = localStorage.getItem(DEFAULTS_STORAGE_KEY)
    if (!stored) return

    const parsed = JSON.parse(stored) as unknown
    if (!isRecord(parsed)) return
    const { selectedOptimizations: storedSelectedOptimizations, changes: storedChanges } = parsed

    defaults.selectedOptimizations =
      Array.isArray(storedSelectedOptimizations) &&
      storedSelectedOptimizations.every(isSelectedOptimization)
        ? storedSelectedOptimizations
        : undefined
    defaults.changes =
      Array.isArray(storedChanges) && storedChanges.every(isChange) ? storedChanges : undefined
  } catch (error) {
    storageLogger.warn(`Failed to read localStorage key "${DEFAULTS_STORAGE_KEY}"`, error)
  }
}

function persistOverrideState(): void {
  try {
    if (overrides.size === 0) {
      localStorage.removeItem(OVERRIDES_STORAGE_KEY)
      localStorage.removeItem(DEFAULTS_STORAGE_KEY)
      return
    }

    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(Object.fromEntries(overrides)))
    if ((defaults.selectedOptimizations ?? defaults.changes) !== undefined) {
      localStorage.setItem(DEFAULTS_STORAGE_KEY, JSON.stringify(defaults))
    }
  } catch (error) {
    storageLogger.warn('Failed to persist preview panel override state', error)
  }
}

/** @internal */
function syncOverrides(
  panel: {
    optimizationEntries: OptimizationEntry[]
    defaultSelectedOptimizations: SelectedOptimizationArray
    overrides: Map<string, number> | undefined
  },
  signals: Pick<Signals, 'changes' | 'selectedOptimizations'>,
  signalFns: Pick<SignalFns, 'batch'>,
): void {
  if (defaults.selectedOptimizations === undefined && signals.selectedOptimizations.value) {
    defaults.selectedOptimizations = [...signals.selectedOptimizations.value]
    panel.defaultSelectedOptimizations = [...defaults.selectedOptimizations]
  }

  if (defaults.changes === undefined && signals.changes.value) {
    defaults.changes = [...signals.changes.value]
  }

  panel.overrides = new Map(overrides)
  signalFns.batch(() => {
    signals.selectedOptimizations.value = applyOptimizationOverrides(
      defaults.selectedOptimizations ?? [],
      overrides,
    )
    signals.changes.value = applyChangeOverrides(
      defaults.changes ?? [],
      panel.optimizationEntries,
      overrides,
    )
  })
  persistOverrideState()
}

/**
 * Throws if a preview panel element already exists in the DOM.
 *
 * @throws Error if the panel has already been attached.
 *
 * @internal
 */
function canDefineComponents(): void {
  const existing = document.querySelector(PANEL_TAG)

  if (existing)
    throw new Error(
      '[ContentfulOptimization Preview Panel] The preview panel has already been attached',
    )
}

/**
 * Configuration for {@link attachOptimizationPreviewPanel}.
 *
 * @internal
 */
export interface AttachOptimizationPreviewPanelArgs {
  /** Contentful client used to fetch audience and optimization entries. */
  contentful: ContentfulClientApi<ChainModifiers>
  /** ContentfulOptimization Web SDK instance to register the preview panel with. */
  optimization: ContentfulOptimization
  /** Optional CSP nonce passed to the Lit framework for style injection. */
  nonce: string | undefined
}

/**
 * Attaches the ContentfulOptimization preview panel to the DOM as a Web Component.
 *
 * Registers all custom elements, fetches audiences and optimization entries from
 * Contentful, wires up state interceptors, and appends the panel to
 * `document.body`.
 *
 * @param args - Configuration containing the Contentful client, ContentfulOptimization instance, and optional CSP nonce.
 * @returns Resolves once the panel has been appended to the document body.
 * @throws Error if the preview panel has already been attached.
 * @throws Error if optimization states cannot be obtained during registration.
 *
 * @example
 * ```ts
 * import attachOptimizationPreviewPanel from '@contentful/optimization-web-preview-panel'
 *
 * await attachOptimizationPreviewPanel({ contentful: client, optimization, nonce: undefined })
 * ```
 *
 * @public
 */
export default async function attachOptimizationPreviewPanel({
  contentful,
  optimization: contentfulOptimization,
  nonce,
}: AttachOptimizationPreviewPanelArgs): Promise<void> {
  canDefineComponents()

  if (nonce !== undefined) window.litNonce = nonce

  const previewPanelSignalObject: PreviewPanelSignalObject = {}

  contentfulOptimization.registerPreviewPanel(previewPanelSignalObject)

  const signals = Reflect.get(previewPanelSignalObject, PREVIEW_PANEL_SIGNALS_SYMBOL)
  const signalFns = Reflect.get(previewPanelSignalObject, PREVIEW_PANEL_SIGNAL_FNS_SYMBOL)

  if (!signals || !signalFns)
    throw new Error(
      '[ContentfulOptimization Preview Panel] The preview panel failed to find optimization states',
    )

  loadOverrides()
  loadDefaults()

  defineIndicator()
  defineMatchedText()
  defineOptimization()
  defineSearch()
  defineAudienceSwitch()
  defineAudience()
  defineAudiences()
  definePanel()

  const [audiences, optimizationEntries]: [Entry[], Entry[]] = await Promise.all([
    getAllEntries<AudienceEntrySkeleton>(contentful, 'nt_audience'),
    getAllEntries<OptimizationEntrySkeleton>(contentful, 'nt_experience'),
  ])

  const panel = document.createElement(PANEL_TAG)
  if (!isPanel(panel))
    throw new Error(
      '[ContentfulOptimization Preview Panel] The preview panel cannot be initialized; contact support',
    )

  panel.overrides = new Map(overrides)
  panel.defaultSelectedOptimizations = [...(defaults.selectedOptimizations ?? [])]
  panel.audiences = audiences.filter(isAudienceEntry)
  panel.optimizationEntries = optimizationEntries.filter(
    (optimization): optimization is OptimizationEntry => isOptimizationEntry(optimization),
  )

  contentfulOptimization.interceptors.state.add((states): OptimizationData => {
    const { changes, selectedOptimizations, ...otherStates } = states

    defaults = {
      selectedOptimizations: [...selectedOptimizations],
      changes: [...changes],
    }
    panel.defaultSelectedOptimizations = [...selectedOptimizations]
    if (overrides.size > 0) persistOverrideState()

    return {
      ...otherStates,
      changes: applyChangeOverrides(changes, panel.optimizationEntries, overrides),
      selectedOptimizations: applyOptimizationOverrides(selectedOptimizations, overrides),
    }
  })

  panel.addEventListener(PANEL_DRAWER_TOGGLE, (event: Event) => {
    if (!isDrawerToggleEvent(event)) return

    const {
      detail: { value: open },
    } = event

    signals.previewPanelOpen.value = open
  })

  panel.addEventListener(OPTIMIZATION_CHANGE, (event: Event) => {
    if (!isRecordRadioGroupChangeEvent(event)) return

    const {
      detail: { key: experienceId, value: variantIndex },
    } = event
    overrides.set(experienceId, variantIndex)
    syncOverrides(panel, signals, signalFns)
  })

  panel.addEventListener(AUDIENCE_SWITCH_CHANGE, (event: Event) => {
    if (!isAudienceSwitchChangeEvent(event)) return
    const [target] = event.composedPath()
    if (!(target instanceof Element) || !isAudience(target)) return

    for (const {
      fields: { nt_experience_id: experienceId },
    } of target.optimizations) {
      overrides.delete(experienceId)
    }

    for (const { key: experienceId, value: variantIndex } of event.detail) {
      overrides.set(experienceId, variantIndex)
    }

    syncOverrides(panel, signals, signalFns)
  })

  panel.addEventListener(PANEL_RESET, () => {
    overrides.clear()
    syncOverrides(panel, signals, signalFns)
    panel.defaultSelectedOptimizations = [...(defaults.selectedOptimizations ?? [])]
  })

  signalFns.effect(() => {
    const {
      profile: { value: profile },
    } = signals
    if (profile) panel.profile = profile
  })

  if (overrides.size > 0) {
    syncOverrides(panel, signals, signalFns)
  }

  document.body.appendChild(panel)

  signals.previewPanelAttached.value = true
}
