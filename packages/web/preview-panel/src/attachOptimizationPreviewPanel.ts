import { getPreviewPanelBridge } from '@contentful/optimization-core/bridge-support'
import {
  PreviewOverrideManager,
  buildPreviewModel,
  createAudienceDefinitions,
  createExperienceDefinitions,
  type OverrideState,
} from '@contentful/optimization-core/preview-support'
import type ContentfulOptimization from '@contentful/optimization-web'
import { isRecord, type OptimizationEntry } from '@contentful/optimization-web/api-schemas'
import { createScopedLogger } from '@contentful/optimization-web/logger'
import type { ChainModifiers, ContentfulClientApi } from 'contentful'
import {
  AUDIENCE_SWITCH_CHANGE,
  AUDIENCE_TAG,
  Audience,
  OPTIMIZATION_CHANGE,
  isAudienceSwitchChangeEvent,
  type AudienceSwitchChangeDetail,
} from './components/audience'
import { AUDIENCE_SWITCH_TAG, AudienceSwitch } from './components/audience-switch'
import { AUDIENCES_TAG, Audiences } from './components/audiences'
import { INDICATOR_TAG, Indicator } from './components/indicator'
import { MATCHED_TEXT_TAG, MatchedText } from './components/matched-text'
import {
  OPTIMIZATION_TAG,
  Optimization,
  isRecordRadioGroupChangeEvent,
} from './components/optimization'
import {
  PANEL_DRAWER_TOGGLE,
  PANEL_RESET,
  PANEL_TAG,
  Panel,
  isDrawerToggleEvent,
} from './components/panel'
import { SEARCH_TAG, Search } from './components/search'
import { getAllEntries, isOptimizationEntry } from './lib/entries'

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
const EMPTY_OVERRIDES: OverrideState = {
  audiences: {},
  selectedOptimizations: {},
}
const PREVIEW_PANEL_ELEMENTS: Array<readonly [string, CustomElementConstructor]> = [
  [INDICATOR_TAG, Indicator],
  [MATCHED_TEXT_TAG, MatchedText],
  [OPTIMIZATION_TAG, Optimization],
  [SEARCH_TAG, Search],
  [AUDIENCE_SWITCH_TAG, AudienceSwitch],
  [AUDIENCE_TAG, Audience],
  [AUDIENCES_TAG, Audiences],
  [PANEL_TAG, Panel],
]

function definePreviewPanelComponents(): void {
  for (const [tag, elementClass] of PREVIEW_PANEL_ELEMENTS) {
    if (!customElements.get(tag)) customElements.define(tag, elementClass)
  }
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

function resetAudienceSwitch(
  manager: PreviewOverrideManager,
  { audienceId, experienceIds }: AudienceSwitchChangeDetail,
): void {
  if (audienceId) {
    manager.resetAudienceOverride(audienceId)
    return
  }

  for (const experienceId of experienceIds) {
    manager.resetOptimizationOverride(experienceId)
  }
}

function applyAudienceSwitchChange(
  manager: PreviewOverrideManager,
  detail: AudienceSwitchChangeDetail,
): void {
  const { audienceId, experienceIds, variantChanges } = detail

  if (variantChanges.length === 0) {
    resetAudienceSwitch(manager, detail)
    return
  }

  if (!audienceId) {
    for (const { key, value } of variantChanges) {
      manager.setVariantOverride(key, value)
    }
    return
  }

  const variantIndex = variantChanges[0]?.value ?? 0
  if (variantIndex === 1) {
    manager.activateAudience(audienceId, experienceIds)
  } else {
    manager.deactivateAudience(audienceId, experienceIds)
  }
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

  const bridge = getPreviewPanelBridge(contentfulOptimization)
  const {
    changes,
    consent,
    previewPanelAttached,
    previewPanelOpen,
    profile,
    selectedOptimizations,
    stateInterceptors,
  } = bridge

  const initialOverrides = loadOverridesFromStorage()

  definePreviewPanelComponents()

  const [audienceCollection, optimizationCollection] = await Promise.all([
    getAllEntries(contentful, 'nt_audience'),
    getAllEntries(contentful, 'nt_experience', { include: 10 }),
  ])
  const panelOptimizationEntries: OptimizationEntry[] = []
  optimizationCollection.items.forEach((entry) => {
    if (isOptimizationEntry(entry)) panelOptimizationEntries.push(entry)
  })
  const audienceDefinitions = createAudienceDefinitions(audienceCollection)
  const experienceDefinitions = createExperienceDefinitions(optimizationCollection)

  const panel = document.createElement(PANEL_TAG)
  if (!(panel instanceof Panel))
    throw new Error(
      '[ContentfulOptimization Preview Panel] The preview panel cannot be initialized; contact support',
    )

  let currentOverrides: OverrideState = EMPTY_OVERRIDES
  const managerRef: { current: PreviewOverrideManager | undefined } = { current: undefined }

  const updatePreviewModel = (): void => {
    const { audiencesWithExperiences } = buildPreviewModel({
      audienceDefinitions,
      experienceDefinitions,
      signals: {
        profile: profile.value,
        selectedOptimizations: selectedOptimizations.value,
        consent: consent.value,
        isLoading: false,
      },
      overrides: currentOverrides,
      baselineSelectedOptimizations: managerRef.current?.getBaselineSelectedOptimizations() ?? null,
    })

    panel.audienceGroups = audiencesWithExperiences
  }

  const manager = new PreviewOverrideManager({
    selectedOptimizations,
    changes,
    optimizationEntries: () => panelOptimizationEntries,
    profile,
    stateInterceptors,
    onOverridesChanged: (state) => {
      currentOverrides = {
        audiences: { ...state.audiences },
        selectedOptimizations: { ...state.selectedOptimizations },
      }
      const overridesMap = overridesToMap(state.selectedOptimizations)
      persistOverrideMap(overridesMap)
      updatePreviewModel()
    },
  })
  managerRef.current = manager

  panel.addEventListener(PANEL_DRAWER_TOGGLE, (event: Event) => {
    if (!isDrawerToggleEvent(event)) return

    const {
      detail: { value: open },
    } = event

    previewPanelOpen.value = open
  })

  panel.addEventListener(OPTIMIZATION_CHANGE, (event: Event) => {
    if (!isRecordRadioGroupChangeEvent(event)) return

    const {
      detail: { key: experienceId, value: variantIndex },
    } = event
    manager.setVariantOverride(experienceId, variantIndex)
  })

  panel.addEventListener(AUDIENCE_SWITCH_CHANGE, (event: Event) => {
    if (!isAudienceSwitchChangeEvent(event)) return

    applyAudienceSwitchChange(manager, event.detail)
  })

  panel.addEventListener(PANEL_RESET, () => {
    manager.resetAll()
  })

  profile.subscribe(updatePreviewModel)
  selectedOptimizations.subscribe(updatePreviewModel)
  updatePreviewModel()

  // Hydrate overrides loaded from storage into the manager so its state
  // interceptor and downstream signals reflect them on first render.
  for (const [experienceId, variantIndex] of initialOverrides) {
    manager.setVariantOverride(experienceId, variantIndex)
  }

  document.body.appendChild(panel)

  previewPanelAttached.value = true
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
