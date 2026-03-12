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
export type PersonalizationLifecycleMode = 'spa' | 'hybrid-ssr-spa'

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

  /**
   * Controls rendering lifecycle semantics.
   *
   * @remarks
   * - `spa`: Non-personalized entries render immediately once entry data is present.
   * - `hybrid-ssr-spa`: Non-personalized entries wait for client-side SDK initialization.
   */
  lifecycleMode?: PersonalizationLifecycleMode
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
const LOADING_LAYOUT_TARGET_STYLE = Object.freeze({
  display: 'block' as const,
})
const LOADING_LAYOUT_TARGET_STYLE_INLINE = Object.freeze({
  display: 'inline' as const,
})
const LOADING_LAYOUT_TARGET_STYLE_HIDDEN = Object.freeze({
  display: 'block' as const,
  visibility: 'hidden' as const,
})
const LOADING_LAYOUT_TARGET_STYLE_INLINE_HIDDEN = Object.freeze({
  display: 'inline' as const,
  visibility: 'hidden' as const,
})
const PersonalizationNestingContext = createContext<ReadonlySet<string> | null>(null)
const logger = createScopedLogger('React:Personalization')

function useDuplicateBaselineGuard(baselineEntryId: string): {
  currentAndAncestorBaselineIds: ReadonlySet<string>
  hasDuplicateBaselineAncestor: boolean
} {
  const ancestorBaselineIds = useContext(PersonalizationNestingContext)
  const warnedDuplicateBaselineId = useRef(false)
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

  return { currentAndAncestorBaselineIds, hasDuplicateBaselineAncestor }
}

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

function resolveLoadingLayoutTargetStyle(
  wrapperElement: PersonalizationWrapperElement,
  isInvisible: boolean,
):
  | typeof LOADING_LAYOUT_TARGET_STYLE
  | typeof LOADING_LAYOUT_TARGET_STYLE_INLINE
  | typeof LOADING_LAYOUT_TARGET_STYLE_HIDDEN
  | typeof LOADING_LAYOUT_TARGET_STYLE_INLINE_HIDDEN {
  if (isInvisible) {
    if (wrapperElement === 'span') {
      return LOADING_LAYOUT_TARGET_STYLE_INLINE_HIDDEN
    }

    return LOADING_LAYOUT_TARGET_STYLE_HIDDEN
  }

  if (wrapperElement === 'span') {
    return LOADING_LAYOUT_TARGET_STYLE_INLINE
  }

  return LOADING_LAYOUT_TARGET_STYLE
}

function resolveContentReadyState(params: {
  lifecycleMode: PersonalizationLifecycleMode
  requiresPersonalization: boolean
  canPersonalize: boolean
  sdkInitialized: boolean
}): boolean {
  const { lifecycleMode, requiresPersonalization, canPersonalize, sdkInitialized } = params

  if (requiresPersonalization) {
    return canPersonalize
  }

  if (lifecycleMode === 'hybrid-ssr-spa') {
    return sdkInitialized
  }

  return true
}

export function Personalization({
  baselineEntry,
  children,
  liveUpdates,
  as = 'div',
  testId,
  'data-testid': dataTestIdProp,
  loadingFallback,
  lifecycleMode = 'spa',
}: PersonalizationProps): JSX.Element {
  const optimization = useOptimization()
  const liveUpdatesContext = useLiveUpdates()
  const {
    sys: { id: baselineEntryId },
  } = baselineEntry
  const { currentAndAncestorBaselineIds, hasDuplicateBaselineAncestor } =
    useDuplicateBaselineGuard(baselineEntryId)

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
  const [sdkInitialized, setSdkInitialized] = useState(false)

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

  useEffect(() => {
    setSdkInitialized(true)
  }, [])

  const resolvedData: ResolvedData<EntrySkeletonType> = useMemo(
    () => optimization.personalizeEntry(baselineEntry, lockedPersonalizations),
    [optimization, baselineEntry, lockedPersonalizations],
  )

  const requiresPersonalization = hasPersonalizationReferences(baselineEntry)
  const isContentReady = resolveContentReadyState({
    canPersonalize,
    lifecycleMode,
    requiresPersonalization,
    sdkInitialized,
  })
  const isLoading = !isContentReady
  const showLoadingFallback = isLoading
  const resolvedLoadingFallback =
    resolveLoadingFallback(loadingFallback) ?? DEFAULT_LOADING_FALLBACK
  const isInvisibleLoading = lifecycleMode === 'hybrid-ssr-spa' && isLoading
  const dataTestId = dataTestIdProp ?? testId
  const Wrapper = as

  if (showLoadingFallback) {
    const LoadingLayoutTarget = Wrapper
    const loadingLayoutTargetStyle = resolveLoadingLayoutTargetStyle(as, isInvisibleLoading)

    return (
      <PersonalizationNestingContext.Provider value={currentAndAncestorBaselineIds}>
        <Wrapper style={WRAPPER_STYLE} data-testid={dataTestId}>
          <LoadingLayoutTarget
            data-ctfl-loading-layout-target="true"
            style={loadingLayoutTargetStyle}
          >
            {resolvedLoadingFallback}
          </LoadingLayoutTarget>
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
