import type {
  SelectedPersonalization,
  SelectedPersonalizationArray,
} from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react'
import { useLiveUpdates } from '../hooks/useLiveUpdates'
import { useOptimization } from '../hooks/useOptimization'
import { createScopedLogger } from '../logger'

export type PersonalizationLoadingFallback = ReactNode | (() => ReactNode)
export type PersonalizationWrapperElement = 'div' | 'span'
export type PersonalizationRenderProp = (resolvedEntry: Entry) => ReactNode

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
   * Consumer content rendered inside the wrapper.
   *
   * @remarks
   * Supports either:
   * - render-prop form: `(resolvedEntry) => ReactNode`
   * - direct node form: `ReactNode`
   */
  children: ReactNode | PersonalizationRenderProp

  /**
   * Whether this component should react to personalization state changes in real-time.
   * When `undefined`, inherits from the `liveUpdates` prop on {@link OptimizationRoot}.
   */
  liveUpdates?: boolean

  /**
   * Wrapper element used to mount tracking attributes.
   * Defaults to `div`.
   *
   * @remarks
   * Wrapper uses `display: contents` to be as layout-neutral as possible.
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
  if (typeof loadingFallback === 'function') {
    return loadingFallback()
  }
  return loadingFallback
}

function isPersonalizationRenderProp(
  children: PersonalizationProps['children'],
): children is PersonalizationRenderProp {
  return typeof children === 'function'
}

function resolveChildren(children: PersonalizationProps['children'], entry: Entry): ReactNode {
  if (!isPersonalizationRenderProp(children)) {
    return children
  }

  return children(entry)
}

const WRAPPER_STYLE = Object.freeze({ display: 'contents' as const })
const DEFAULT_LOADING_FALLBACK = (
  <span data-ctfl-loading="true" aria-label="Loading content">
    Loading...
  </span>
)
const PersonalizationNestingContext = createContext<ReadonlySet<string> | null>(null)
const logger = createScopedLogger('React:Personalization')

function hasPersonalizationReferences(entry: Entry): boolean {
  const { fields } = entry
  const { nt_experiences: ntExperiences } = fields
  if (!Array.isArray(ntExperiences)) {
    return false
  }
  return ntExperiences.length > 0
}

function resolveDuplicationScope(
  personalization: SelectedPersonalization | undefined,
): string | undefined {
  const candidate =
    personalization && typeof personalization === 'object' && 'duplicationScope' in personalization
      ? personalization.duplicationScope
      : undefined
  if (typeof candidate !== 'string') {
    return undefined
  }
  return candidate.trim() ? candidate : undefined
}

function resolveShouldLiveUpdate(params: {
  previewPanelVisible: boolean
  componentLiveUpdates: boolean | undefined
  globalLiveUpdates: boolean
}): boolean {
  const { previewPanelVisible, componentLiveUpdates, globalLiveUpdates } = params
  if (previewPanelVisible) {
    return true
  }
  return componentLiveUpdates ?? globalLiveUpdates
}

function resolveTrackingAttributes(
  resolvedData: ResolvedData<EntrySkeletonType>,
): Record<string, string | undefined> {
  const {
    personalization,
    entry: {
      sys: { id: entryId },
    },
  } = resolvedData

  return {
    'data-ctfl-duplication-scope': resolveDuplicationScope(personalization),
    'data-ctfl-entry-id': entryId,
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
  const optimization = useOptimization()
  const liveUpdatesContext = useLiveUpdates()
  const ancestorBaselineIds = useContext(PersonalizationNestingContext)
  const warnedDuplicateBaselineId = useRef(false)
  const {
    sys: { id: baselineEntryId },
  } = baselineEntry
  const hasDuplicateBaselineAncestor = ancestorBaselineIds?.has(baselineEntryId) ?? false

  useEffect(() => {
    if (!hasDuplicateBaselineAncestor || warnedDuplicateBaselineId.current) {
      return
    }

    if (process.env.NODE_ENV !== 'production') {
      logger.warn(
        `[Personalization] Nested Personalization with baseline entry ID "${baselineEntryId}" is blocked.`,
      )
    }

    warnedDuplicateBaselineId.current = true
  }, [baselineEntryId, hasDuplicateBaselineAncestor])

  const currentAndAncestorBaselineIds = useMemo(() => {
    const nextIds = new Set(ancestorBaselineIds ?? [])
    nextIds.add(baselineEntryId)
    return nextIds
  }, [ancestorBaselineIds, baselineEntryId])

  if (hasDuplicateBaselineAncestor) {
    return <></>
  }

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

  const requiresPersonalization = hasPersonalizationReferences(baselineEntry)
  const isLoading = requiresPersonalization && !canPersonalize
  const showLoadingFallback = isLoading
  const resolvedLoadingFallback =
    resolveLoadingFallback(loadingFallback) ?? DEFAULT_LOADING_FALLBACK
  const dataTestId = dataTestIdProp ?? testId
  const Wrapper = as

  if (showLoadingFallback) {
    return (
      <PersonalizationNestingContext.Provider value={currentAndAncestorBaselineIds}>
        <Wrapper style={WRAPPER_STYLE} data-testid={dataTestId}>
          {resolvedLoadingFallback}
        </Wrapper>
      </PersonalizationNestingContext.Provider>
    )
  }

  const trackingAttributes = resolveTrackingAttributes(resolvedData)

  return (
    <PersonalizationNestingContext.Provider value={currentAndAncestorBaselineIds}>
      <Wrapper style={WRAPPER_STYLE} data-testid={dataTestId} {...trackingAttributes}>
        {resolveChildren(children, resolvedData.entry)}
      </Wrapper>
    </PersonalizationNestingContext.Provider>
  )
}

export default Personalization
