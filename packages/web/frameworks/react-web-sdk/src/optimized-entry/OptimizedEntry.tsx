import type { Entry } from 'contentful'
import { createContext, useContext, useEffect, useMemo, useRef, type JSX } from 'react'
import { createScopedLogger } from '../logger'
import { DefaultLoadingFallback } from './DefaultLoadingFallback'
import {
  resolveChildren,
  resolveLoadingFallback,
  resolveLoadingLayoutTargetStyle,
  resolveLoadingRenderState,
  resolveTrackingAttributes,
  type LoadingFallback,
  type OptimizedEntryChildren,
  type RenderProp,
  type WrapperElement,
} from './optimizedEntryUtils'
import { useOptimizedEntry } from './useOptimizedEntry'

export type OptimizedEntryLoadingFallback = LoadingFallback
export type OptimizedEntryWrapperElement = WrapperElement
export type OptimizedEntryRenderProp = RenderProp

/**
 * Props for the {@link OptimizedEntry} component.
 *
 * @public
 */
export interface OptimizedEntryProps {
  /**
   * The baseline Contentful entry fetched with `include: 10`.
   * Must include `nt_experiences` field with linked personalization data.
   */
  baselineEntry: Entry
  /**
   * Render prop that receives the resolved variant entry.
   */
  children: OptimizedEntryChildren
  /**
   * Whether this component should react to personalization state changes in real-time.
   * When `undefined`, inherits from the `liveUpdates` prop on {@link OptimizationRoot}.
   */
  liveUpdates?: boolean
  /**
   * Wrapper element used to mount tracking attributes.
   * Defaults to `div`.
   */
  as?: OptimizedEntryWrapperElement
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
  loadingFallback?: OptimizedEntryLoadingFallback
}

const WRAPPER_STYLE = Object.freeze({ display: 'contents' as const })
const OptimizedEntryNestingContext = createContext<ReadonlySet<string> | null>(null)
const logger = createScopedLogger('React:OptimizedEntry')

function useDuplicateBaselineGuard(baselineEntryId: string): {
  currentAndAncestorBaselineIds: ReadonlySet<string>
  hasDuplicateBaselineAncestor: boolean
} {
  const ancestorBaselineIds = useContext(OptimizedEntryNestingContext)
  const warnedDuplicateBaselineId = useRef(false)
  const hasDuplicateBaselineAncestor = ancestorBaselineIds?.has(baselineEntryId) ?? false

  useEffect(() => {
    if (!hasDuplicateBaselineAncestor || warnedDuplicateBaselineId.current) {
      return
    }

    if (process.env.NODE_ENV !== 'production') {
      logger.warn(
        `[OptimizedEntry] Nested component with baseline entry ID "${baselineEntryId}" is blocked.`,
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

export function OptimizedEntry({
  baselineEntry,
  children,
  liveUpdates,
  as = 'div',
  testId,
  'data-testid': dataTestIdProp,
  loadingFallback,
}: OptimizedEntryProps): JSX.Element {
  const {
    sys: { id: baselineEntryId },
  } = baselineEntry
  const { currentAndAncestorBaselineIds, hasDuplicateBaselineAncestor } =
    useDuplicateBaselineGuard(baselineEntryId)
  const { entry, isLoading, isReady, resolvedData } = useOptimizedEntry({
    baselineEntry,
    liveUpdates,
  })

  if (hasDuplicateBaselineAncestor) {
    return <></>
  }

  const hasCustomLoadingFallback = loadingFallback !== undefined
  const baselineContent = resolveChildren(children, baselineEntry)
  const resolvedLoadingFallback = hasCustomLoadingFallback ? (
    resolveLoadingFallback(loadingFallback)
  ) : (
    <DefaultLoadingFallback>{baselineContent}</DefaultLoadingFallback>
  )
  const { hideLoadingLayoutTarget, loadingContent, showLoadingFallback } =
    resolveLoadingRenderState({
      baselineChildren: children,
      baselineEntry,
      hasCustomLoadingFallback,
      isLoading,
      resolvedLoadingFallback,
      sdkInitialized: isReady,
    })
  const dataTestId = dataTestIdProp ?? testId
  const Wrapper = as

  if (showLoadingFallback) {
    const LoadingLayoutTarget = Wrapper
    const loadingLayoutTargetStyle = resolveLoadingLayoutTargetStyle(as, hideLoadingLayoutTarget)

    return (
      <OptimizedEntryNestingContext.Provider value={currentAndAncestorBaselineIds}>
        <Wrapper style={WRAPPER_STYLE} data-testid={dataTestId}>
          <LoadingLayoutTarget
            data-ctfl-loading-layout-target="true"
            style={loadingLayoutTargetStyle}
          >
            {loadingContent}
          </LoadingLayoutTarget>
        </Wrapper>
      </OptimizedEntryNestingContext.Provider>
    )
  }

  const trackingAttributes = resolveTrackingAttributes(resolvedData)

  return (
    <OptimizedEntryNestingContext.Provider value={currentAndAncestorBaselineIds}>
      <Wrapper style={WRAPPER_STYLE} data-testid={dataTestId} {...trackingAttributes}>
        {resolveChildren(children, entry)}
      </Wrapper>
    </OptimizedEntryNestingContext.Provider>
  )
}

export default OptimizedEntry
