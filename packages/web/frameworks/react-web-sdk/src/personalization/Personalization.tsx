import type {
  SelectedPersonalization,
  SelectedPersonalizationArray,
} from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'
import { useEffect, useMemo, useState, type JSX, type ReactNode } from 'react'
import { useLiveUpdates } from '../hooks/useLiveUpdates'
import { useOptimization } from '../hooks/useOptimization'

export type PersonalizationLoadingFallback = ReactNode | (() => ReactNode)
export type PersonalizationWrapperElement = 'div' | 'span'

/**
 * Props for the {@link Personalization} component.
 *
 * @public
 */
export interface PersonalizationProps {
  /**
   * The baseline Contentful entry fetched with `include: 10`.
   * Must include `nt_experiences` field with linked personalization data.
   */
  baselineEntry: Entry

  /**
   * Render prop that receives the resolved variant entry.
   */
  children: (resolvedEntry: Entry) => ReactNode

  /**
   * Whether this component should react to personalization state changes in real-time.
   * When `undefined`, inherits from the `liveUpdates` prop on {@link OptimizationRoot}.
   */
  liveUpdates?: boolean

  /**
   * Wrapper element used to mount tracking attributes.
   * Defaults to `div`.
   */
  as?: PersonalizationWrapperElement

  /**
   * Optional test id prop.
   */
  testId?: string

  /**
   * Optional data-testid prop.
   */
  'data-testid'?: string

  /**
   * Optional fallback rendered while personalization state is unresolved.
   */
  loadingFallback?: PersonalizationLoadingFallback
}

function resolveLoadingFallback(
  loadingFallback: PersonalizationLoadingFallback | undefined,
): ReactNode {
  if (typeof loadingFallback === 'function') return loadingFallback()
  return loadingFallback
}

const WRAPPER_STYLE = Object.freeze({ display: 'contents' as const })

function resolveDuplicationScope(
  personalization: SelectedPersonalization | undefined,
): string | undefined {
  const candidate =
    personalization && typeof personalization === 'object' && 'duplicationScope' in personalization
      ? personalization.duplicationScope
      : undefined
  if (typeof candidate !== 'string') return undefined
  return candidate.trim() ? candidate : undefined
}

function resolveShouldLiveUpdate(params: {
  previewPanelVisible: boolean
  componentLiveUpdates: boolean | undefined
  globalLiveUpdates: boolean
}): boolean {
  const { previewPanelVisible, componentLiveUpdates, globalLiveUpdates } = params
  if (previewPanelVisible) return true
  return componentLiveUpdates ?? globalLiveUpdates
}

function resolveTrackingAttributes(
  resolvedData: ResolvedData<EntrySkeletonType>,
): Record<string, string | undefined> {
  const { personalization } = resolvedData

  return {
    'data-ctfl-duplication-scope': resolveDuplicationScope(personalization),
    'data-ctfl-entry-id': resolvedData.entry.sys.id,
    'data-ctfl-personalization-id': personalization?.experienceId,
    'data-ctfl-sticky':
      personalization?.sticky === undefined ? undefined : String(personalization.sticky),
    'data-ctfl-variant-index': String(personalization?.variantIndex ?? 0),
  }
}

export function Personalization({
  baselineEntry,
  children,
  liveUpdates,
  as = 'div',
  testId,
  'data-testid': dataTestIdProp,
  loadingFallback,
}: PersonalizationProps): JSX.Element {
  const contentfulOptimization = useOptimization()
  const liveUpdatesContext = useLiveUpdates()

  const shouldLiveUpdate = resolveShouldLiveUpdate({
    componentLiveUpdates: liveUpdates,
    globalLiveUpdates: liveUpdatesContext.globalLiveUpdates,
    previewPanelVisible: liveUpdatesContext.previewPanelVisible,
  })

  const [lockedSelectedPersonalizations, setLockedSelectedPersonalizations] = useState<
    SelectedPersonalizationArray | undefined
  >(undefined)
  const [canPersonalize, setCanPersonalize] = useState(false)

  useEffect(() => {
    const selectedPersonalizationsSubscription =
      contentfulOptimization.states.selectedPersonalizations.subscribe((p) => {
        setLockedSelectedPersonalizations((previous) => {
          if (shouldLiveUpdate) {
            // Live updates enabled - always update state
            return p
          }

          if (previous === undefined && p !== undefined) {
            // First non-undefined value - lock it
            return p
          }

          // Otherwise ignore updates (we're locked to the initial value)
          return previous
        })
      })
    const canPersonalizeSubscription = contentfulOptimization.states.canPersonalize.subscribe(
      (value) => {
        setCanPersonalize(value)
      },
    )

    return () => {
      selectedPersonalizationsSubscription.unsubscribe()
      canPersonalizeSubscription.unsubscribe()
    }
  }, [contentfulOptimization, shouldLiveUpdate])

  const resolvedData: ResolvedData<EntrySkeletonType> = useMemo(
    () => contentfulOptimization.personalizeEntry(baselineEntry, lockedSelectedPersonalizations),
    [contentfulOptimization, baselineEntry, lockedSelectedPersonalizations],
  )

  const isLoading = !canPersonalize
  const showLoadingFallback = loadingFallback !== undefined && isLoading
  const dataTestId = dataTestIdProp ?? testId
  const Wrapper = as

  if (showLoadingFallback) {
    return (
      <Wrapper style={WRAPPER_STYLE} data-testid={dataTestId}>
        {resolveLoadingFallback(loadingFallback)}
      </Wrapper>
    )
  }

  const trackingAttributes = resolveTrackingAttributes(resolvedData)

  return (
    <Wrapper style={WRAPPER_STYLE} data-testid={dataTestId} {...trackingAttributes}>
      {children(resolvedData.entry)}
    </Wrapper>
  )
}

export default Personalization
