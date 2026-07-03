import {
  OPTIMIZED_ENTRY_HOST_DISPLAY,
  resolveOptimizedEntryNestingState,
} from '@contentful/optimization-web/presentation'
import type { Entry } from 'contentful'
import { createContext, useContext, useEffect, useMemo, useRef, type JSX } from 'react'
import { useOptimization } from '../hooks/useOptimization'
import { createScopedLogger } from '../logger'
import {
  resolveChildren,
  resolveLoadingFallback,
  resolveLoadingLayoutTargetStyle,
  type LoadingFallback,
  type OptimizedEntryChildren,
  type OptimizedEntryRenderContext,
  type RenderProp,
  type WrapperElement,
} from './optimizedEntryUtils'
import { useOptimizedEntrySnapshot } from './useOptimizedEntry'

export type OptimizedEntryLoadingFallback = LoadingFallback
export type { OptimizedEntryRenderContext }
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
   * Must include `nt_experiences` field with linked optimization data.
   */
  baselineEntry: Entry
  /**
   * Render prop that receives the resolved variant entry.
   */
  children: OptimizedEntryChildren
  /**
   * Whether this component reacts to optimization state changes in real time.
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
   * Optional fallback rendered while optimization state is unresolved.
   */
  loadingFallback?: OptimizedEntryLoadingFallback
  /**
   * Marks the optimized entry wrapper as a click target for entry click tracking.
   */
  clickable?: boolean
  /**
   * Per-component override for click tracking.
   */
  trackClicks?: boolean
  /**
   * Per-component override for hover tracking.
   */
  trackHovers?: boolean
  /**
   * Per-component override for view tracking.
   */
  trackViews?: boolean
  /**
   * Per-component override for view-duration update events, in milliseconds.
   */
  viewDurationUpdateIntervalMs?: number
  /**
   * Per-component override for hover-duration update events, in milliseconds.
   */
  hoverDurationUpdateIntervalMs?: number
}

const WRAPPER_STYLE = Object.freeze({ display: OPTIMIZED_ENTRY_HOST_DISPLAY })
const OptimizedEntryNestingContext = createContext<ReadonlySet<string> | null>(null)
const logger = createScopedLogger('React:OptimizedEntry')

function useDuplicateBaselineGuard(baselineEntryId: string): {
  currentAndAncestorBaselineIds: ReadonlySet<string>
  hasDuplicateBaselineAncestor: boolean
} {
  const ancestorBaselineIds = useContext(OptimizedEntryNestingContext)
  const warnedDuplicateBaselineId = useRef(false)
  const { currentAndAncestorBaselineIds, hasDuplicateBaselineAncestor } = useMemo(
    () => resolveOptimizedEntryNestingState(baselineEntryId, ancestorBaselineIds),
    [ancestorBaselineIds, baselineEntryId],
  )

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
  clickable,
  hoverDurationUpdateIntervalMs,
  trackClicks,
  trackHovers,
  trackViews,
  viewDurationUpdateIntervalMs,
}: OptimizedEntryProps): JSX.Element | null {
  const sdk = useOptimization()
  const renderContext = useMemo<OptimizedEntryRenderContext>(
    () => ({
      getMergeTagValue: (embeddedEntryNodeTarget, profile) =>
        sdk.getMergeTagValue(embeddedEntryNodeTarget, profile),
    }),
    [sdk],
  )
  const {
    sys: { id: baselineEntryId },
  } = baselineEntry
  const { currentAndAncestorBaselineIds, hasDuplicateBaselineAncestor } =
    useDuplicateBaselineGuard(baselineEntryId)
  const hasCustomLoadingFallback = loadingFallback !== undefined
  const targetDisplay = as === 'span' ? 'inline' : 'block'
  const snapshot = useOptimizedEntrySnapshot({
    baselineEntry,
    clickable,
    hasCustomLoadingFallback,
    hoverDurationUpdateIntervalMs,
    liveUpdates,
    targetDisplay,
    trackClicks,
    trackHovers,
    trackViews,
    viewDurationUpdateIntervalMs,
  })

  if (hasDuplicateBaselineAncestor) {
    return null
  }

  const resolvedLoadingFallback = hasCustomLoadingFallback
    ? resolveLoadingFallback(loadingFallback)
    : undefined
  const { entry, hostAttributes, loadingPresentation } = snapshot
  const {
    hideLoadingLayoutTarget,
    shouldRenderBaselineWhileLoading,
    showLoadingFallback,
    targetDisplay: loadingTargetDisplay,
  } = loadingPresentation
  const loadingContent = shouldRenderBaselineWhileLoading
    ? resolveChildren(children, baselineEntry, renderContext)
    : resolvedLoadingFallback
  const dataTestId = dataTestIdProp ?? testId
  const Wrapper = as

  if (showLoadingFallback) {
    const LoadingLayoutTarget = Wrapper
    const loadingLayoutTargetStyle = resolveLoadingLayoutTargetStyle(
      loadingTargetDisplay,
      hideLoadingLayoutTarget,
    )

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

  return (
    <OptimizedEntryNestingContext.Provider value={currentAndAncestorBaselineIds}>
      <Wrapper style={WRAPPER_STYLE} data-testid={dataTestId} {...hostAttributes}>
        {resolveChildren(children, entry, renderContext)}
      </Wrapper>
    </OptimizedEntryNestingContext.Provider>
  )
}

export default OptimizedEntry
