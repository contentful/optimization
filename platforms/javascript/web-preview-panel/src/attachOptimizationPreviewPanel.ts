import type {
  AudienceEntry,
  AudienceEntrySkeleton,
  Optimization,
  PersonalizationEntry,
  PersonalizationEntrySkeleton,
  PreviewPanelSignalObject,
} from '@contentful/optimization-web'
import type { ChainModifiers, ContentfulClientApi, Entry } from 'contentful'
import { defineCtflOptPreviewAudience } from './components/ctfl-opt-preview-audience'
import { defineCtflOptPreviewIndicator } from './components/ctfl-opt-preview-indicator'
import {
  CTFL_OPT_PREVIEW_PANEL_TAG,
  defineCtflOptPreviewPanel,
  isCtflOptPreviewPanel,
} from './components/ctfl-opt-preview-panel'
import { defineCtflOptPreviewPersonalization } from './components/ctfl-opt-preview-personalization'
import { getAllEntries } from './getAllEntries'

declare global {
  interface Window {
    /** Global nonce value used by the Lit framework */
    litNonce?: string
    /** Global OptimizationPreviewPanel class constructor. */
    attachOptimizationPreviewPanel?: typeof attachOptimizationPreviewPanel
  }
}

function isAudienceEntry(audience: Entry): audience is AudienceEntry {
  return audience.sys.contentType.sys.id === 'nt_audience'
}

function isPersonalizationEntry(personalization: Entry): personalization is PersonalizationEntry {
  return personalization.sys.contentType.sys.id === 'nt_experience'
}

function canDefineComponents(): void {
  const existing = document.querySelector(CTFL_OPT_PREVIEW_PANEL_TAG)

  if (existing)
    throw new Error('[Optimization Preview Panel] The preview panel has already been attached')
}

export default async function attachOptimizationPreviewPanel(
  contentfulClient: ContentfulClientApi<ChainModifiers>,
  optimization: Optimization,
  nonce: string | undefined,
): Promise<void> {
  canDefineComponents()

  if (nonce !== undefined) {
    window.litNonce = nonce
  }

  const previewPanelIntegration: PreviewPanelSignalObject = {
    signals: undefined,
    signalFns: undefined,
  }

  optimization.registerPreviewPanel(previewPanelIntegration)

  const { signals, signalFns } = previewPanelIntegration

  if (!signals || !signalFns)
    throw new Error(
      '[Optimization Preview Panel] The preview panel failed to find optimization states',
    )

  const [audiences, personalizations]: [audiences: Entry[], personalizations: Entry[]] =
    await Promise.all([
      getAllEntries<AudienceEntrySkeleton>(contentfulClient, 'nt_audience'),
      getAllEntries<PersonalizationEntrySkeleton>(contentfulClient, 'nt_experience'),
    ])

  defineCtflOptPreviewIndicator()
  defineCtflOptPreviewPersonalization()
  defineCtflOptPreviewAudience()
  defineCtflOptPreviewPanel()

  const panel = document.createElement(CTFL_OPT_PREVIEW_PANEL_TAG)

  if (!isCtflOptPreviewPanel(panel))
    throw new Error(
      '[Optimization Preview Panel] The preview panel cannot be initialized; contact support',
    )

  const { personalizations: selectedPersonalizations, ...hostSignals } = signals

  panel.audiences = audiences.filter((audience) => isAudienceEntry(audience))
  panel.personalizations = personalizations.filter((personalization) =>
    isPersonalizationEntry(personalization),
  )
  panel.defaultSelectedPersonalizations = [...(signals.personalizations.value ?? [])]
  panel.hostSignalFns = signalFns
  panel.hostSignals = { selectedPersonalizations, ...hostSignals }

  document.body.appendChild(panel)
}
