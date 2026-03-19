import type ContentfulOptimization from '@contentful/optimization-web'
import type {
  AudienceEntrySkeleton,
  ChangeArray,
  OptimizationData,
  PersonalizationEntry,
  PersonalizationEntrySkeleton,
  SelectedPersonalizationArray,
} from '@contentful/optimization-web/api-schemas'
import type {
  PreviewPanelSignalObject,
  SignalFns,
  Signals,
} from '@contentful/optimization-web/core-sdk'
import {
  PREVIEW_PANEL_SIGNAL_FNS_SYMBOL,
  PREVIEW_PANEL_SIGNALS_SYMBOL,
} from '@contentful/optimization-web/symbols'
import type { ChainModifiers, ContentfulClientApi, Entry } from 'contentful'
import {
  CTFL_OPT_PREVIEW_AUDIENCE_SWITCH_CHANGE,
  CTFL_OPT_PREVIEW_PERSONALIZATION_CHANGE,
  defineCtflOptPreviewAudience,
  isAudienceSwitchChangeEvent,
  isCtflOptPreviewAudience,
} from './components/ctfl-opt-preview-audience'
import { defineCtflOptPreviewAudienceSwitch } from './components/ctfl-opt-preview-audience-switch'
import { defineCtflOptPreviewIndicator } from './components/ctfl-opt-preview-indicator'
import {
  CTFL_OPT_PREVIEW_PANEL_DRAWER_TOGGLE,
  CTFL_OPT_PREVIEW_PANEL_RESET,
  CTFL_OPT_PREVIEW_PANEL_TAG,
  defineCtflOptPreviewPanel,
  isCtflOptPreviewPanel,
  isDrawerToggleEvent,
} from './components/ctfl-opt-preview-panel'
import {
  defineCtflOptPreviewPersonalization,
  isRecordRadioGroupChangeEvent,
} from './components/ctfl-opt-preview-personalization'
import { getAllEntries, isAudienceEntry, isPersonalizationEntry } from './lib/entries'
import { applyChangeOverrides, applyPersonalizationOverrides } from './lib/overrides'
import { isChange, isSelectedPersonalization } from './lib/schemaGuards'
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
  selectedPersonalizations?: SelectedPersonalizationArray
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
    const { selectedPersonalizations: storedSelectedPersonalizations, changes: storedChanges } =
      parsed

    defaults.selectedPersonalizations =
      Array.isArray(storedSelectedPersonalizations) &&
      storedSelectedPersonalizations.every(isSelectedPersonalization)
        ? storedSelectedPersonalizations
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
    if ((defaults.selectedPersonalizations ?? defaults.changes) !== undefined) {
      localStorage.setItem(DEFAULTS_STORAGE_KEY, JSON.stringify(defaults))
    }
  } catch (error) {
    storageLogger.warn('Failed to persist preview panel override state', error)
  }
}

/** @internal */
function syncOverrides(
  panel: {
    personalizationEntries: PersonalizationEntry[]
    defaultSelectedPersonalizations: SelectedPersonalizationArray
    overrides: Map<string, number> | undefined
  },
  signals: Pick<Signals, 'changes' | 'selectedPersonalizations'>,
  signalFns: Pick<SignalFns, 'batch'>,
): void {
  if (defaults.selectedPersonalizations === undefined && signals.selectedPersonalizations.value) {
    defaults.selectedPersonalizations = [...signals.selectedPersonalizations.value]
    panel.defaultSelectedPersonalizations = [...defaults.selectedPersonalizations]
  }

  if (defaults.changes === undefined && signals.changes.value) {
    defaults.changes = [...signals.changes.value]
  }

  panel.overrides = new Map(overrides)
  signalFns.batch(() => {
    signals.selectedPersonalizations.value = applyPersonalizationOverrides(
      defaults.selectedPersonalizations ?? [],
      overrides,
    )
    signals.changes.value = applyChangeOverrides(
      defaults.changes ?? [],
      panel.personalizationEntries,
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
  const existing = document.querySelector(CTFL_OPT_PREVIEW_PANEL_TAG)

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
interface AttachOptimizationPreviewPanelArgs {
  /** Contentful client used to fetch audience and personalization entries. */
  contentful: ContentfulClientApi<ChainModifiers>
  /** ContentfulOptimization Web SDK instance to register the preview panel with. */
  optimization: ContentfulOptimization
  /** Optional CSP nonce passed to the Lit framework for style injection. */
  nonce: string | undefined
}

/**
 * Attaches the ContentfulOptimization preview panel to the DOM as a Web Component.
 *
 * Registers all custom elements, fetches audiences and personalizations from
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

  defineCtflOptPreviewIndicator()
  defineCtflOptPreviewPersonalization()
  defineCtflOptPreviewAudienceSwitch()
  defineCtflOptPreviewAudience()
  defineCtflOptPreviewPanel()

  const [audiences, personalizationEntries]: [Entry[], Entry[]] = await Promise.all([
    getAllEntries<AudienceEntrySkeleton>(contentful, 'nt_audience'),
    getAllEntries<PersonalizationEntrySkeleton>(contentful, 'nt_experience'),
  ])

  const panel = document.createElement(CTFL_OPT_PREVIEW_PANEL_TAG)
  if (!isCtflOptPreviewPanel(panel))
    throw new Error(
      '[ContentfulOptimization Preview Panel] The preview panel cannot be initialized; contact support',
    )

  panel.overrides = new Map(overrides)
  panel.defaultSelectedPersonalizations = [...(defaults.selectedPersonalizations ?? [])]
  panel.audiences = audiences.filter(isAudienceEntry)
  panel.personalizationEntries = personalizationEntries.filter(
    (personalization): personalization is PersonalizationEntry =>
      isPersonalizationEntry(personalization),
  )

  contentfulOptimization.interceptors.state.add((states): OptimizationData => {
    const { changes, selectedPersonalizations, ...otherStates } = states

    defaults = {
      selectedPersonalizations: [...selectedPersonalizations],
      changes: [...changes],
    }
    panel.defaultSelectedPersonalizations = [...selectedPersonalizations]
    if (overrides.size > 0) persistOverrideState()

    return {
      ...otherStates,
      changes: applyChangeOverrides(changes, panel.personalizationEntries, overrides),
      selectedPersonalizations: applyPersonalizationOverrides(selectedPersonalizations, overrides),
    }
  })

  panel.addEventListener(CTFL_OPT_PREVIEW_PANEL_DRAWER_TOGGLE, (event: Event) => {
    if (!isDrawerToggleEvent(event)) return

    const {
      detail: { value: open },
    } = event

    signals.previewPanelOpen.value = open
  })

  panel.addEventListener(CTFL_OPT_PREVIEW_PERSONALIZATION_CHANGE, (event: Event) => {
    if (!isRecordRadioGroupChangeEvent(event)) return

    const {
      detail: { key: experienceId, value: variantIndex },
    } = event
    overrides.set(experienceId, variantIndex)
    syncOverrides(panel, signals, signalFns)
  })

  panel.addEventListener(CTFL_OPT_PREVIEW_AUDIENCE_SWITCH_CHANGE, (event: Event) => {
    if (!isAudienceSwitchChangeEvent(event)) return
    const [target] = event.composedPath()
    if (!(target instanceof Element) || !isCtflOptPreviewAudience(target)) return

    for (const {
      fields: { nt_experience_id: experienceId },
    } of target.personalizations) {
      overrides.delete(experienceId)
    }

    for (const { key: experienceId, value: variantIndex } of event.detail) {
      overrides.set(experienceId, variantIndex)
    }

    syncOverrides(panel, signals, signalFns)
  })

  panel.addEventListener(CTFL_OPT_PREVIEW_PANEL_RESET, () => {
    overrides.clear()
    syncOverrides(panel, signals, signalFns)
    panel.defaultSelectedPersonalizations = [...(defaults.selectedPersonalizations ?? [])]
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
