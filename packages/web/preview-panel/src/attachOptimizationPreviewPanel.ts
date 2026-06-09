import { PreviewOverrideManager } from '@contentful/optimization-core/preview-support'
import type ContentfulOptimization from '@contentful/optimization-web'
import type {
  AudienceEntrySkeleton,
  ChangeArray,
  OptimizationData,
  OptimizationEntry,
  OptimizationEntrySkeleton,
  Profile,
  SelectedOptimizationArray,
} from '@contentful/optimization-web/api-schemas'
import type { PreviewPanelSignalObject } from '@contentful/optimization-web/core-sdk'
import { PREVIEW_PANEL_SIGNALS_SYMBOL } from '@contentful/optimization-web/symbols'
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
import { applyChangeOverrides } from './lib/overrides'
import { isChange, isSelectedOptimization } from './lib/schemaGuards'
import { createScopedLogger } from './logger'

declare global {
  interface Window {
    /** Singleton Optimization Web SDK instance. */
    contentfulOptimization?: ContentfulOptimization
    /** Global nonce value used by the Lit framework */
    litNonce?: string
    /** Global OptimizationPreviewPanel class constructor. */
    attachOptimizationPreviewPanel?: typeof attachOptimizationPreviewPanel
  }
}

/** @internal */
let storedDefaults: {
  selectedOptimizations?: SelectedOptimizationArray
  changes?: ChangeArray
} = {}

/** @internal */
let previewPanelAttachment: Promise<void> | undefined = undefined

const OVERRIDES_STORAGE_KEY = '__ctfl_opt_preview_overrides__'
const DEFAULTS_STORAGE_KEY = '__ctfl_opt_preview_defaults__'
const storageLogger = createScopedLogger('PreviewPanelStorage')

/** @internal */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** @internal */
function loadOverridesFromStorage(): Map<string, number> {
  const overrides = new Map<string, number>()

  try {
    const stored = localStorage.getItem(OVERRIDES_STORAGE_KEY)
    if (!stored) return overrides

    const parsed = JSON.parse(stored) as unknown
    if (!isRecord(parsed)) return overrides

    for (const [experienceId, variantIndex] of Object.entries(parsed)) {
      if (typeof variantIndex === 'number') overrides.set(experienceId, variantIndex)
    }
  } catch (error) {
    storageLogger.warn(`Failed to read localStorage key "${OVERRIDES_STORAGE_KEY}"`, error)
  }

  return overrides
}

/** @internal */
function loadDefaultsFromStorage(): void {
  storedDefaults = {}

  try {
    const stored = localStorage.getItem(DEFAULTS_STORAGE_KEY)
    if (!stored) return

    const parsed = JSON.parse(stored) as unknown
    if (!isRecord(parsed)) return
    const { selectedOptimizations: storedSelectedOptimizations, changes: storedChanges } = parsed

    storedDefaults.selectedOptimizations =
      Array.isArray(storedSelectedOptimizations) &&
      storedSelectedOptimizations.every(isSelectedOptimization)
        ? storedSelectedOptimizations
        : undefined
    storedDefaults.changes =
      Array.isArray(storedChanges) && storedChanges.every(isChange) ? storedChanges : undefined
  } catch (error) {
    storageLogger.warn(`Failed to read localStorage key "${DEFAULTS_STORAGE_KEY}"`, error)
  }
}

function persistOverrideState(overrides: Map<string, number>): void {
  try {
    if (overrides.size === 0) {
      localStorage.removeItem(OVERRIDES_STORAGE_KEY)
      localStorage.removeItem(DEFAULTS_STORAGE_KEY)
      return
    }

    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(Object.fromEntries(overrides)))
    if ((storedDefaults.selectedOptimizations ?? storedDefaults.changes) !== undefined) {
      localStorage.setItem(DEFAULTS_STORAGE_KEY, JSON.stringify(storedDefaults))
    }
  } catch (error) {
    storageLogger.warn('Failed to persist preview panel override state', error)
  }
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

function hasPreviewPanel(): boolean {
  return typeof document !== 'undefined' && document.querySelector(PANEL_TAG) !== null
}

function resolveOptimization(
  optimization: ContentfulOptimization | undefined,
): ContentfulOptimization | undefined {
  if (optimization !== undefined) return optimization
  if (typeof window === 'undefined') return undefined

  return window.contentfulOptimization
}

/**
 * Configuration for {@link attachOptimizationPreviewPanelToSdk}.
 *
 * @internal
 */
interface AttachOptimizationPreviewPanelToSdkArgs<M extends ChainModifiers = ChainModifiers> {
  /** Contentful client used to fetch audience and optimization entries. */
  contentful: ContentfulClientApi<M>
  /** ContentfulOptimization Web SDK instance to register the preview panel with. */
  optimization: ContentfulOptimization
  /** Optional CSP nonce passed to the Lit framework for style injection. */
  nonce: string | undefined
}

/**
 * Configuration for {@link attachOptimizationPreviewPanel}.
 *
 * @public
 */
export interface AttachOptimizationPreviewPanelArgs<M extends ChainModifiers = ChainModifiers> {
  /** Contentful client used to fetch audience and optimization entries. */
  contentful: ContentfulClientApi<M>
  /**
   * ContentfulOptimization Web SDK instance to register the preview panel with.
   *
   * @remarks
   * When omitted, the attach function uses `window.contentfulOptimization`.
   */
  optimization?: ContentfulOptimization
  /** Optional CSP nonce passed to the Lit framework for style injection. */
  nonce?: string
}

/**
 * Convert the manager's selectedOptimizations override record into the
 * `Map<string, number>` shape consumed by the panel UI and `applyChangeOverrides`.
 *
 * @internal
 */
function overridesToMap(
  selectedOptimizations: Record<string, { experienceId: string; variantIndex: number }>,
): Map<string, number> {
  const result = new Map<string, number>()
  for (const { experienceId, variantIndex } of Object.values(selectedOptimizations)) {
    result.set(experienceId, variantIndex)
  }
  return result
}

/**
 * Attaches the ContentfulOptimization preview panel to the supplied SDK instance.
 *
 * Registers all custom elements, fetches audiences and optimization entries from
 * Contentful, wires up state interceptors via the shared
 * {@link PreviewOverrideManager}, and appends the panel to `document.body`.
 *
 * @param args - Configuration containing the Contentful client, ContentfulOptimization instance, and optional CSP nonce.
 * @returns Resolves once the panel has been appended to the document body.
 * @throws Error if the preview panel has already been attached.
 * @throws Error if optimization states cannot be obtained during registration.
 *
 * @internal
 */
async function attachOptimizationPreviewPanelToSdk<M extends ChainModifiers = ChainModifiers>({
  contentful,
  optimization: contentfulOptimization,
  nonce,
}: AttachOptimizationPreviewPanelToSdkArgs<M>): Promise<void> {
  canDefineComponents()

  if (nonce !== undefined) window.litNonce = nonce

  const previewPanelSignalObject: PreviewPanelSignalObject = {}

  contentfulOptimization.registerPreviewPanel(previewPanelSignalObject)

  const signals = Reflect.get(previewPanelSignalObject, PREVIEW_PANEL_SIGNALS_SYMBOL)

  if (!signals)
    throw new Error(
      '[ContentfulOptimization Preview Panel] The preview panel failed to find optimization states',
    )

  const initialOverrides = loadOverridesFromStorage()
  loadDefaultsFromStorage()

  defineIndicator()
  defineMatchedText()
  defineOptimization()
  defineSearch()
  defineAudienceSwitch()
  defineAudience()
  defineAudiences()
  definePanel()

  const [audiences, optimizationEntries]: [Entry[], Entry[]] = await Promise.all([
    getAllEntries<AudienceEntrySkeleton, M>(contentful, 'nt_audience'),
    getAllEntries<OptimizationEntrySkeleton, M>(contentful, 'nt_experience'),
  ])

  const panel = document.createElement(PANEL_TAG)
  if (!isPanel(panel))
    throw new Error(
      '[ContentfulOptimization Preview Panel] The preview panel cannot be initialized; contact support',
    )

  panel.audiences = audiences.filter(isAudienceEntry)
  panel.optimizationEntries = optimizationEntries.filter(
    (optimization): optimization is OptimizationEntry => isOptimizationEntry(optimization),
  )
  panel.defaultSelectedOptimizations = [...(storedDefaults.selectedOptimizations ?? [])]
  panel.overrides = new Map(initialOverrides)

  const syncChangesSignal = (overridesMap: Map<string, number>): void => {
    if (storedDefaults.changes === undefined) return
    signals.changes.value = applyChangeOverrides(
      storedDefaults.changes,
      panel.optimizationEntries,
      overridesMap,
    )
  }

  const manager = new PreviewOverrideManager({
    selectedOptimizations: signals.selectedOptimizations,
    profile: signals.profile,
    stateInterceptors: contentfulOptimization.interceptors.state,
    onOverridesChanged: (state) => {
      const overridesMap = overridesToMap(state.selectedOptimizations)
      panel.overrides = new Map(overridesMap)
      persistOverrideState(overridesMap)
      syncChangesSignal(overridesMap)
    },
  })

  // Web-only interceptor: keep the inline-variable Variable changes in sync
  // with overrides. The manager's interceptor runs first and rewrites
  // selectedOptimizations to honor overrides; we read the clean baseline back
  // from the manager so storedDefaults / panel.defaultSelectedOptimizations
  // reflect the un-overridden state.
  contentfulOptimization.interceptors.state.add((states): OptimizationData => {
    const { changes, ...otherStates } = states
    const baseline = manager.getBaselineSelectedOptimizations() ?? states.selectedOptimizations

    storedDefaults = {
      selectedOptimizations: [...baseline],
      changes: [...changes],
    }
    panel.defaultSelectedOptimizations = [...baseline]

    const overridesMap = overridesToMap(manager.getOverrides().selectedOptimizations)
    if (overridesMap.size > 0) persistOverrideState(overridesMap)

    return {
      ...otherStates,
      selectedOptimizations: states.selectedOptimizations,
      changes: applyChangeOverrides(changes, panel.optimizationEntries, overridesMap),
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
    manager.setVariantOverride(experienceId, variantIndex)
  })

  const onAudienceSwitchReset = (audienceId: string | undefined, experienceIds: string[]): void => {
    if (audienceId) {
      manager.resetAudienceOverride(audienceId)
      return
    }
    for (const experienceId of experienceIds) {
      manager.resetOptimizationOverride(experienceId)
    }
  }

  const onAudienceSwitchActivate = (
    audienceId: string,
    experienceIds: string[],
    variantIndex: number,
  ): void => {
    if (variantIndex === 1) {
      manager.activateAudience(audienceId, experienceIds)
    } else {
      manager.deactivateAudience(audienceId, experienceIds)
    }
  }

  panel.addEventListener(AUDIENCE_SWITCH_CHANGE, (event: Event) => {
    if (!isAudienceSwitchChangeEvent(event)) return
    const [target] = event.composedPath()
    if (!(target instanceof Element) || !isAudience(target)) return

    const audienceId = target.audience?.sys.id
    const experienceIds = target.optimizations.map(({ fields: { nt_experience_id: id } }) => id)

    if (event.detail.length === 0) {
      onAudienceSwitchReset(audienceId, experienceIds)
      return
    }

    if (!audienceId) {
      for (const { key, value } of event.detail) {
        manager.setVariantOverride(key, value)
      }
      return
    }

    const variantIndex = event.detail[0]?.value ?? 0
    onAudienceSwitchActivate(audienceId, experienceIds, variantIndex)
  })

  panel.addEventListener(PANEL_RESET, () => {
    manager.resetAll()
    panel.defaultSelectedOptimizations = [...(storedDefaults.selectedOptimizations ?? [])]
  })

  signals.profile.subscribe((profile: Profile | undefined) => {
    if (profile) panel.profile = profile
  })

  // Hydrate overrides loaded from storage into the manager so its state
  // interceptor and downstream signals reflect them on first render. The
  // manager re-derives `signals.selectedOptimizations` from its baseline on
  // every setVariantOverride call.
  if (initialOverrides.size > 0) {
    for (const [experienceId, variantIndex] of initialOverrides) {
      manager.setVariantOverride(experienceId, variantIndex)
    }

    // Re-apply change overrides against the cached changes baseline so
    // inline-variable flag values reflect the restored selection until the
    // next API refresh runs the interceptor chain.
    if (storedDefaults.changes) {
      signals.changes.value = applyChangeOverrides(
        storedDefaults.changes,
        panel.optimizationEntries,
        initialOverrides,
      )
    }
  }

  document.body.appendChild(panel)

  signals.previewPanelAttached.value = true
}

/**
 * Attaches the ContentfulOptimization preview panel to the DOM as a Web Component.
 *
 * Registers all custom elements, fetches audiences and optimization entries from
 * Contentful, wires up state interceptors, and appends the panel to
 * `document.body`.
 * Calling this function more than once reuses the existing in-flight or completed
 * attachment.
 *
 * @param args - Configuration containing the Contentful client, optional ContentfulOptimization instance, and optional CSP nonce.
 * @returns Resolves once the panel has been appended to the document body.
 * @throws Error if no Optimization Web SDK instance can be resolved.
 * @throws Error if optimization states cannot be obtained during registration.
 *
 * @example
 * ```ts
 * import attachOptimizationPreviewPanel from '@contentful/optimization-web-preview-panel'
 *
 * await attachOptimizationPreviewPanel({ contentful: client, nonce: undefined })
 * ```
 *
 * @public
 */
export default async function attachOptimizationPreviewPanel<
  M extends ChainModifiers = ChainModifiers,
>({ contentful, optimization, nonce }: AttachOptimizationPreviewPanelArgs<M>): Promise<void> {
  if (previewPanelAttachment !== undefined) {
    await previewPanelAttachment
    return
  }

  if (hasPreviewPanel()) {
    return
  }

  const resolvedOptimization = resolveOptimization(optimization)

  if (resolvedOptimization === undefined) {
    throw new Error(
      '[ContentfulOptimization Preview Panel] ContentfulOptimization is not initialized',
    )
  }

  previewPanelAttachment = attachOptimizationPreviewPanelToSdk({
    contentful,
    optimization: resolvedOptimization,
    nonce,
  }).catch((error: unknown) => {
    previewPanelAttachment = undefined
    throw error
  })

  await previewPanelAttachment
}
