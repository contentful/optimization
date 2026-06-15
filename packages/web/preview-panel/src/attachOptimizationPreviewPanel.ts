import { PreviewOverrideManager } from '@contentful/optimization-core/preview-support'
import type ContentfulOptimization from '@contentful/optimization-web'
import type {
  AudienceEntrySkeleton,
  OptimizationEntry,
  OptimizationEntrySkeleton,
  Profile,
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
let previewPanelAttachment: Promise<void> | undefined = undefined

const OVERRIDES_STORAGE_KEY = '__ctfl_opt_preview_overrides__'
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

function persistOverrideMap(overrides: Map<string, number>): void {
  try {
    if (overrides.size === 0) {
      localStorage.removeItem(OVERRIDES_STORAGE_KEY)
      return
    }

    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(Object.fromEntries(overrides)))
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
 * Convert the manager's selectedOptimizations override record into the
 * `Map<string, number>` shape consumed by the panel UI and the localStorage
 * persistence helpers.
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
 * Attaches the ContentfulOptimization preview panel to the supplied SDK instance.
 *
 * Registers all custom elements, fetches audiences and optimization entries from
 * Contentful, wires up the shared {@link PreviewOverrideManager}, and appends
 * the panel to `document.body`.
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
  panel.overrides = new Map(initialOverrides)
  panel.defaultSelectedOptimizations = []

  const manager = new PreviewOverrideManager({
    selectedOptimizations: signals.selectedOptimizations,
    changes: signals.changes,
    optimizationEntries: () => panel.optimizationEntries,
    profile: signals.profile,
    stateInterceptors: contentfulOptimization.interceptors.state,
    onOverridesChanged: (state) => {
      const overridesMap = overridesToMap(state.selectedOptimizations)
      panel.overrides = new Map(overridesMap)
      persistOverrideMap(overridesMap)

      // Keep the panel UI's "default" badges in sync with whatever the manager
      // currently considers the un-overridden API baseline.
      const baseline = manager.getBaselineSelectedOptimizations()
      if (baseline) panel.defaultSelectedOptimizations = [...baseline]
    },
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
  })

  signals.profile.subscribe((profile: Profile | undefined) => {
    if (profile) panel.profile = profile
  })

  // Hydrate overrides loaded from storage into the manager so its state
  // interceptor and downstream signals reflect them on first render.
  for (const [experienceId, variantIndex] of initialOverrides) {
    manager.setVariantOverride(experienceId, variantIndex)
  }

  document.body.appendChild(panel)

  signals.previewPanelAttached.value = true
}

/**
 * Attaches the ContentfulOptimization preview panel to the DOM as a Web Component.
 *
 * Registers all custom elements, fetches audiences and optimization entries from
 * Contentful, wires up the shared override manager, and appends the panel to
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
