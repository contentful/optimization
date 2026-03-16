import type ContentfulOptimization from '@contentful/optimization-web'
import {
  normalizePersonalizationConfig,
  type AudienceEntrySkeleton,
  type OptimizationData,
  type PersonalizationEntry,
  type PersonalizationEntrySkeleton,
  type SelectedPersonalizationArray,
} from '@contentful/optimization-web/api-schemas'
import type { PreviewPanelSignalObject } from '@contentful/optimization-web/core-sdk'
import {
  PREVIEW_PANEL_SIGNAL_FNS_SYMBOL,
  PREVIEW_PANEL_SIGNALS_SYMBOL,
} from '@contentful/optimization-web/symbols'
import type { ChainModifiers, ContentfulClientApi, Entry } from 'contentful'
import {
  CTFL_OPT_PREVIEW_PERSONALIZATION_CHANGE,
  defineCtflOptPreviewAudience,
} from './components/ctfl-opt-preview-audience'
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
import { applyPersonalizationOverrides } from './lib/overrides'

declare global {
  interface Window {
    /** Global nonce value used by the Lit framework */
    litNonce?: string
    /** Global OptimizationPreviewPanel class constructor. */
    attachOptimizationPreviewPanel?: typeof attachOptimizationPreviewPanel
  }
}

/** @internal */
let defaults: SelectedPersonalizationArray = []

/** @internal */
const overrides = new Map<string, number>()

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

  const [audiences, personalizationEntries]: [Entry[], Entry[]] = await Promise.all([
    getAllEntries<AudienceEntrySkeleton>(contentful, 'nt_audience'),
    getAllEntries<PersonalizationEntrySkeleton>(contentful, 'nt_experience'),
  ])

  defineCtflOptPreviewIndicator()
  defineCtflOptPreviewPersonalization()
  defineCtflOptPreviewAudience()
  defineCtflOptPreviewPanel()

  const panel = document.createElement(CTFL_OPT_PREVIEW_PANEL_TAG)
  if (!isCtflOptPreviewPanel(panel))
    throw new Error(
      '[ContentfulOptimization Preview Panel] The preview panel cannot be initialized; contact support',
    )

  panel.overrides = overrides
  panel.audiences = audiences.filter(isAudienceEntry)
  panel.personalizationEntries = personalizationEntries.filter(
    (personalization): personalization is PersonalizationEntry =>
      isPersonalizationEntry(personalization) &&
      !normalizePersonalizationConfig(personalization.fields.nt_config).components.some(
        (component) => component.type === 'InlineVariable',
      ),
  )

  contentfulOptimization.interceptors.state.add((states): OptimizationData => {
    const { selectedPersonalizations, ...otherStates } = states

    defaults = [...selectedPersonalizations]
    panel.defaultSelectedPersonalizations = defaults

    return {
      ...otherStates,
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
    signals.selectedPersonalizations.value = applyPersonalizationOverrides(
      signals.selectedPersonalizations.value ?? [],
      overrides,
    )
  })

  panel.addEventListener(CTFL_OPT_PREVIEW_PANEL_RESET, () => {
    overrides.clear()
    signals.selectedPersonalizations.value = [...defaults]
    panel.defaultSelectedPersonalizations = [...defaults]
  })

  signalFns.effect(() => {
    const {
      profile: { value: profile },
    } = signals
    if (profile) panel.profile = profile
  })

  document.body.appendChild(panel)

  signals.previewPanelAttached.value = true
}
