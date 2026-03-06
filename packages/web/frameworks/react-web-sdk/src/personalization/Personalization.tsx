import type {
  SelectedPersonalization,
  SelectedPersonalizationArray,
} from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'
import { useEffect, useMemo, useState, type CSSProperties, type JSX, type ReactNode } from 'react'
import { useLiveUpdates } from '../hooks/useLiveUpdates'
import { useOptimization } from '../hooks/useOptimization'

export type PersonalizationLoadingFallback = ReactNode | (() => ReactNode)

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
   * Optional style prop for the wrapper element.
   */
  style?: CSSProperties

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
  style,
  testId,
  'data-testid': dataTestIdProp,
  loadingFallback,
}: PersonalizationProps): JSX.Element {
  const optimization = useOptimization()
  const liveUpdatesContext = useLiveUpdates()

  const shouldLiveUpdate = resolveShouldLiveUpdate({
    componentLiveUpdates: liveUpdates,
    globalLiveUpdates: liveUpdatesContext.globalLiveUpdates,
    previewPanelVisible: liveUpdatesContext.previewPanelVisible,
  })

  const [lockedPersonalizations, setLockedPersonalizations] = useState<
    SelectedPersonalizationArray | undefined
  >(undefined)
  const [canPersonalize, setCanPersonalize] = useState(false)

  useEffect(() => {
    const personalizationsSubscription = optimization.states.personalizations.subscribe((p) => {
      setLockedPersonalizations((previous) => {
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
    const canPersonalizeSubscription = optimization.states.canPersonalize.subscribe((value) => {
      setCanPersonalize(value)
    })

    return () => {
      personalizationsSubscription.unsubscribe()
      canPersonalizeSubscription.unsubscribe()
    }
  }, [optimization, shouldLiveUpdate])

  const resolvedData: ResolvedData<EntrySkeletonType> = useMemo(
    () => optimization.personalizeEntry(baselineEntry, lockedPersonalizations),
    [optimization, baselineEntry, lockedPersonalizations],
  )

  const isLoading = !canPersonalize
  const showLoadingFallback = loadingFallback !== undefined && isLoading
  const dataTestId = dataTestIdProp ?? testId

  if (showLoadingFallback) {
    return (
      <div style={style} data-testid={dataTestId}>
        {resolveLoadingFallback(loadingFallback)}
      </div>
    )
  }

  const trackingAttributes = resolveTrackingAttributes(resolvedData)

  return (
    <div style={style} data-testid={dataTestId} {...trackingAttributes}>
      {children(resolvedData.entry)}
    </div>
  )
}

export default Personalization
