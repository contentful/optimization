import type {
  ChangeArray,
  OptimizationEntry,
  SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import { signal } from '@preact/signals-core'
import type { OptimizationSelectionState } from '../handoff'
import { InterceptorManager } from '../lib/interceptor'
import { PreviewOverrideManager } from './PreviewOverrideManager'
import {
  BASELINE,
  makeOptimizationData,
  type InterceptorFn,
} from './PreviewOverrideManager.test-utils'

const INITIAL_CHANGES: ChangeArray = [
  { key: 'a', type: 'Variable', value: 1, meta: { experienceId: 'exp-1', variantIndex: 0 } },
  { key: 'b', type: 'Variable', value: 2, meta: { experienceId: 'exp-2', variantIndex: 0 } },
]

let selectedOptimizations: ReturnType<typeof signal<SelectedOptimizationArray | undefined>>
let changes: ReturnType<typeof signal<ChangeArray | undefined>>
let stateInterceptors: InterceptorManager<OptimizationSelectionState>
let capturedInterceptor: InterceptorFn | undefined
let manager: PreviewOverrideManager | undefined

function createManager(
  opts: { withChanges?: boolean; entries?: readonly OptimizationEntry[] } = {},
): PreviewOverrideManager {
  const { withChanges = true, entries = [] } = opts
  selectedOptimizations = signal<SelectedOptimizationArray | undefined>(BASELINE)
  changes = signal<ChangeArray | undefined>(INITIAL_CHANGES)
  stateInterceptors = new InterceptorManager<OptimizationSelectionState>()
  capturedInterceptor = undefined
  rs.spyOn(stateInterceptors, 'add').mockImplementation((fn: InterceptorFn) => {
    capturedInterceptor = fn
    return 1
  })
  rs.spyOn(stateInterceptors, 'remove').mockImplementation(() => true)
  manager = new PreviewOverrideManager({
    selectedOptimizations,
    changes: withChanges ? changes : undefined,
    optimizationEntries: () => entries,
    stateInterceptors,
    onOverridesChanged: rs.fn(),
  })
  return manager
}

describe('PreviewOverrideManager — changes coordination', () => {
  afterEach(() => {
    manager?.destroy()
    manager = undefined
  })

  it('captures initial changes signal as baseline', () => {
    const mgr = createManager()
    expect(mgr.getBaselineChanges()).toEqual(INITIAL_CHANGES)
  })

  it('restores changes signal to baseline on resetAll', () => {
    const mgr = createManager()
    mgr.setVariantOverride('exp-1', 1)
    // Manually mutate so we can prove resetAll rewrites the signal value.
    changes.value = []
    mgr.resetAll()
    expect(changes.value).toEqual(INITIAL_CHANGES)
  })

  it('restores changes baseline on resetAll when no selected baseline exists', () => {
    selectedOptimizations = signal<SelectedOptimizationArray | undefined>(undefined)
    changes = signal<ChangeArray | undefined>(INITIAL_CHANGES)
    stateInterceptors = new InterceptorManager<OptimizationSelectionState>()
    manager = new PreviewOverrideManager({
      selectedOptimizations,
      changes,
      stateInterceptors,
      onOverridesChanged: rs.fn(),
    })

    manager.setVariantOverride('exp-1', 1)
    changes.value = []
    manager.resetAll()

    expect(changes.value).toEqual(INITIAL_CHANGES)
  })

  it('updates changes baseline on API-refresh interceptor', async () => {
    const mgr = createManager()
    mgr.setVariantOverride('exp-1', 1)
    if (!capturedInterceptor) throw new Error('Interceptor not captured')

    const refreshedChanges: ChangeArray = [
      { key: 'a', type: 'Variable', value: 99, meta: { experienceId: 'exp-1', variantIndex: 0 } },
    ]
    await capturedInterceptor({
      ...makeOptimizationData(BASELINE),
      changes: refreshedChanges,
    })

    // After the API refresh, the manager treats the new payload as the baseline.
    expect(mgr.getBaselineChanges()).toEqual(refreshedChanges)

    // resetAll restores to the *new* baseline, not the original.
    mgr.resetAll()
    expect(changes.value).toEqual(refreshedChanges)
  })

  it('leaves changes baseline unchanged when refresh omits changes', async () => {
    const mgr = createManager()
    if (!capturedInterceptor) throw new Error('Interceptor not captured')

    await capturedInterceptor({ selectedOptimizations: BASELINE })

    expect(mgr.getBaselineChanges()).toEqual(INITIAL_CHANGES)
  })

  it('captures present undefined changes baseline for resetAll', async () => {
    const mgr = createManager()
    if (!capturedInterceptor) throw new Error('Interceptor not captured')

    await capturedInterceptor({ changes: undefined, selectedOptimizations: BASELINE })
    changes.value = INITIAL_CHANGES
    mgr.resetAll()

    expect(changes.value).toBeUndefined()
  })

  it('falls back to single-signal sync when no changes signal is configured (backward-compat)', () => {
    const mgr = createManager({ withChanges: false })
    mgr.setVariantOverride('exp-1', 1)
    expect(selectedOptimizations.value?.find((s) => s.experienceId === 'exp-1')?.variantIndex).toBe(
      1,
    )
  })
})
