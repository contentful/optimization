import type {
  ContentfulEntryQuery,
  OptimizedEntryMetadata,
} from '@contentful/optimization-web/core-sdk'
import {
  OPTIMIZED_ENTRY_HOST_DISPLAY,
  createOptimizedEntryLoadingEntry,
  resolveOptimizedEntryNestingState,
} from '@contentful/optimization-web/presentation'
import type { Entry } from 'contentful'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type JSX,
  type ReactNode,
} from 'react'
import { useOptimization } from '../hooks/useOptimization'
import { createScopedLogger } from '../logger'
import {
  resolveChildren,
  resolveErrorFallback,
  resolveLoadingFallback,
  resolveLoadingLayoutTargetStyle,
  type ErrorFallback,
  type LoadingFallback,
  type OptimizedEntryChildren,
  type OptimizedEntryRenderContext,
  type RenderProp,
  type WrapperElement,
} from './optimizedEntryUtils'
import {
  useManagedBaselineEntry,
  useOptimizedEntrySnapshot,
  type UseOptimizedEntryParams,
} from './useOptimizedEntry'

export type OptimizedEntryLoadingFallback = LoadingFallback
export type OptimizedEntryErrorFallback = ErrorFallback
export type { OptimizedEntryRenderContext }
export type OptimizedEntryWrapperElement = WrapperElement
export type OptimizedEntryRenderProp = RenderProp

/**
 * Props for the {@link OptimizedEntry} component.
 *
 * @public
 */
interface OptimizedEntrySharedProps {
  /**
   * Render prop that receives the resolved variant entry and metadata when resolved.
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
   * Optional fallback rendered when SDK-managed entry fetching fails.
   */
  errorFallback?: OptimizedEntryErrorFallback
  /**
   * Callback invoked when SDK-managed entry fetching fails.
   */
  onEntryError?: (error: Error) => void
  /**
   * Callback invoked when a resolved entry is rendered with tracking attributes ready.
   */
  onEntryResolved?: (metadata: OptimizedEntryMetadata) => void
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

type OptimizedEntrySourceProps =
  | {
      /**
       * The baseline Contentful entry fetched with `include: 10`.
       * Must include `nt_experiences` field with linked optimization data.
       */
      baselineEntry: Entry
      entryId?: never
      entryQuery?: never
    }
  | {
      baselineEntry?: never
      /** Contentful entry ID fetched through the SDK-managed Contentful client. */
      entryId: string
      /** Per-call Contentful `getEntry()` query overrides. */
      entryQuery?: ContentfulEntryQuery
    }

/**
 * Props for the {@link OptimizedEntry} component.
 *
 * @public
 */
export type OptimizedEntryProps = OptimizedEntrySharedProps & OptimizedEntrySourceProps

const WRAPPER_STYLE = Object.freeze({ display: OPTIMIZED_ENTRY_HOST_DISPLAY })
const OptimizedEntryNestingContext = createContext<ReadonlySet<string> | null>(null)
const logger = createScopedLogger('React:OptimizedEntry')

interface OptimizedEntryFrameProps {
  readonly children: ReactNode
  readonly currentAndAncestorBaselineIds: ReadonlySet<string>
  readonly dataTestId: string | undefined
  readonly hostAttributes?: Record<string, string | number | boolean | undefined>
  readonly Wrapper: OptimizedEntryWrapperElement
}

function OptimizedEntryFrame({
  children,
  currentAndAncestorBaselineIds,
  dataTestId,
  hostAttributes,
  Wrapper,
}: OptimizedEntryFrameProps): JSX.Element {
  return (
    <OptimizedEntryNestingContext.Provider value={currentAndAncestorBaselineIds}>
      <Wrapper style={WRAPPER_STYLE} data-testid={dataTestId} {...hostAttributes}>
        {children}
      </Wrapper>
    </OptimizedEntryNestingContext.Provider>
  )
}

function hasBaselineEntry(
  entryProps: OptimizedEntrySourceProps,
): entryProps is Extract<OptimizedEntrySourceProps, { baselineEntry: Entry }> {
  return entryProps.baselineEntry !== undefined
}

function resolveEntrySource(
  entryProps: OptimizedEntrySourceProps,
  liveUpdates: boolean | undefined,
  onEntryError: ((error: Error) => void) | undefined,
): { readonly entryId: string | undefined; readonly managedEntryParams: UseOptimizedEntryParams } {
  if (hasBaselineEntry(entryProps)) {
    return {
      entryId: undefined,
      managedEntryParams: { baselineEntry: entryProps.baselineEntry, liveUpdates, onEntryError },
    }
  }

  return {
    entryId: entryProps.entryId,
    managedEntryParams: {
      entryId: entryProps.entryId,
      entryQuery: entryProps.entryQuery,
      liveUpdates,
      onEntryError,
    },
  }
}

function renderErrorFallback(
  errorFallback: OptimizedEntryErrorFallback | undefined,
  error: Error,
  frameProps: Omit<OptimizedEntryFrameProps, 'children'>,
): JSX.Element | null {
  const errorContent = resolveErrorFallback(errorFallback, error)

  if (errorContent === undefined) {
    return null
  }

  return <OptimizedEntryFrame {...frameProps}>{errorContent}</OptimizedEntryFrame>
}

function getTargetDisplay(wrapper: OptimizedEntryWrapperElement): 'block' | 'inline' {
  return wrapper === 'span' ? 'inline' : 'block'
}

interface OptimizedEntryBodyProps {
  readonly Wrapper: OptimizedEntryWrapperElement
  readonly baselineEntry: Entry
  readonly children: OptimizedEntryChildren
  readonly currentAndAncestorBaselineIds: ReadonlySet<string>
  readonly dataTestId: string | undefined
  readonly error: Error | undefined
  readonly errorFallback: OptimizedEntryErrorFallback | undefined
  readonly hasCustomLoadingFallback: boolean
  readonly hasDuplicateBaselineAncestor: boolean
  readonly loadingFallback: OptimizedEntryLoadingFallback | undefined
  readonly managedEntry: Entry | undefined
  readonly renderContext: OptimizedEntryRenderContext
  readonly snapshot: ReturnType<typeof useOptimizedEntrySnapshot>
  readonly targetDisplay: 'block' | 'inline'
}

function renderOptimizedEntryBody({
  Wrapper,
  baselineEntry,
  children,
  currentAndAncestorBaselineIds,
  dataTestId,
  error,
  errorFallback,
  hasCustomLoadingFallback,
  hasDuplicateBaselineAncestor,
  loadingFallback,
  managedEntry,
  renderContext,
  snapshot,
  targetDisplay,
}: OptimizedEntryBodyProps): JSX.Element | null {
  if (hasDuplicateBaselineAncestor) {
    return null
  }

  const frameProps = {
    currentAndAncestorBaselineIds,
    dataTestId,
    Wrapper,
  }

  if (error) {
    return renderErrorFallback(errorFallback, error, frameProps)
  }

  const resolvedLoadingFallback = hasCustomLoadingFallback
    ? resolveLoadingFallback(loadingFallback)
    : undefined

  if (!managedEntry) {
    const loadingLayoutTargetStyle = resolveLoadingLayoutTargetStyle(targetDisplay, false)

    return (
      <OptimizedEntryFrame {...frameProps}>
        <Wrapper data-ctfl-loading-layout-target="true" style={loadingLayoutTargetStyle}>
          {resolvedLoadingFallback}
        </Wrapper>
      </OptimizedEntryFrame>
    )
  }

  const { entry, hostAttributes, isEmptyVariant, loadingPresentation } = snapshot
  const {
    hideLoadingLayoutTarget,
    shouldRenderBaselineWhileLoading,
    showLoadingFallback,
    targetDisplay: loadingTargetDisplay,
  } = loadingPresentation
  const loadingContent = shouldRenderBaselineWhileLoading
    ? resolveChildren(children, baselineEntry, renderContext)
    : resolvedLoadingFallback

  if (showLoadingFallback) {
    const loadingLayoutTargetStyle = resolveLoadingLayoutTargetStyle(
      loadingTargetDisplay,
      hideLoadingLayoutTarget,
    )

    return (
      <OptimizedEntryFrame {...frameProps}>
        <Wrapper data-ctfl-loading-layout-target="true" style={loadingLayoutTargetStyle}>
          {loadingContent}
        </Wrapper>
      </OptimizedEntryFrame>
    )
  }

  return (
    <OptimizedEntryFrame {...frameProps} hostAttributes={hostAttributes}>
      {isEmptyVariant ? null : resolveChildren(children, entry, renderContext)}
    </OptimizedEntryFrame>
  )
}

function shouldNotifyEntryResolved(
  managedEntry: Entry | undefined,
  hasDuplicateBaselineAncestor: boolean,
  isResolved: boolean,
): boolean {
  return managedEntry !== undefined && !hasDuplicateBaselineAncestor && isResolved
}

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
  children,
  liveUpdates,
  as = 'div',
  testId,
  'data-testid': dataTestIdProp,
  loadingFallback,
  errorFallback,
  onEntryError,
  onEntryResolved,
  clickable,
  hoverDurationUpdateIntervalMs,
  trackClicks,
  trackHovers,
  trackViews,
  viewDurationUpdateIntervalMs,
  ...entryProps
}: OptimizedEntryProps): JSX.Element | null {
  const sdk = useOptimization()
  const { entryId, managedEntryParams } = resolveEntrySource(entryProps, liveUpdates, onEntryError)
  const managedEntry = useManagedBaselineEntry(managedEntryParams)
  const loadingEntry = useMemo(
    () => createOptimizedEntryLoadingEntry(entryId ?? 'contentful-entry'),
    [entryId],
  )
  const baselineEntry = managedEntry.entry ?? loadingEntry
  const {
    sys: { id: baselineEntryId },
  } = baselineEntry
  const { currentAndAncestorBaselineIds, hasDuplicateBaselineAncestor } =
    useDuplicateBaselineGuard(baselineEntryId)
  const hasCustomLoadingFallback = loadingFallback !== undefined
  const targetDisplay = getTargetDisplay(as)
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
  const { metadata } = snapshot
  const renderContext = useMemo<OptimizedEntryRenderContext>(
    () => ({
      ...metadata,
      getMergeTagValue: (embeddedEntryNodeTarget, profile) =>
        sdk.getMergeTagValue(embeddedEntryNodeTarget, profile),
    }),
    [metadata, sdk],
  )

  useEffect(() => {
    if (
      shouldNotifyEntryResolved(
        managedEntry.entry,
        hasDuplicateBaselineAncestor,
        snapshot.isResolved,
      )
    ) {
      onEntryResolved?.(metadata)
    }
  }, [
    hasDuplicateBaselineAncestor,
    managedEntry.entry,
    metadata,
    onEntryResolved,
    snapshot.isResolved,
  ])

  return renderOptimizedEntryBody({
    Wrapper: as,
    baselineEntry,
    children,
    currentAndAncestorBaselineIds,
    dataTestId: dataTestIdProp ?? testId,
    error: managedEntry.error,
    errorFallback,
    hasCustomLoadingFallback,
    hasDuplicateBaselineAncestor,
    loadingFallback,
    managedEntry: managedEntry.entry,
    renderContext,
    snapshot,
    targetDisplay,
  })
}

export default OptimizedEntry
