import type { ChangeArray, OptimizationData } from '@contentful/optimization-api-client/api-schemas'
import type { OptimizationSelectionState } from '../handoff'
import { InterceptorManager } from '../lib/interceptor'
import { batch, changes, experienceRequestState, profile, selectedOptimizations } from '../signals'
import { profile as profileFixture } from '../test/fixtures/profile'
import { selectedOptimizations as selectedOptimizationsFixture } from '../test/fixtures/selectedOptimizations'
import { applyOptimizationDataToSignals } from './applyOptimizationDataToSignals'

const changesFixture: ChangeArray = [
  { key: 'flag', type: 'Variable', value: true, meta: { experienceId: 'exp-1', variantIndex: 1 } },
]

const optimizationData: OptimizationData = {
  changes: changesFixture,
  profile: profileFixture,
  selectedOptimizations: selectedOptimizationsFixture,
}

function resetSignals(): void {
  batch(() => {
    changes.value = undefined
    experienceRequestState.value = { status: 'idle' }
    profile.value = undefined
    selectedOptimizations.value = undefined
  })
}

describe('applyOptimizationDataToSignals', () => {
  beforeEach(resetSignals)
  afterEach(resetSignals)

  it('keeps input fields when an interceptor omits them', async () => {
    const stateInterceptors = new InterceptorManager<OptimizationSelectionState>()
    const interceptedProfile = { ...profileFixture, traits: { intercepted: true } }
    stateInterceptors.add(() => ({ profile: interceptedProfile }))

    await applyOptimizationDataToSignals(optimizationData, stateInterceptors)

    expect(changes.value).toEqual(changesFixture)
    expect(profile.value).toEqual(interceptedProfile)
    expect(selectedOptimizations.value).toEqual(selectedOptimizationsFixture)
    expect(experienceRequestState.value).toEqual({ status: 'success' })
  })

  it('keeps fields visible to later interceptors after a sparse state return', async () => {
    const stateInterceptors = new InterceptorManager<OptimizationSelectionState>()
    const interceptedProfile = { ...profileFixture, traits: { intercepted: true } }
    const interceptedChanges: ChangeArray = [
      {
        key: 'flag',
        type: 'Variable',
        value: false,
        meta: { experienceId: 'exp-1', variantIndex: 1 },
      },
    ]
    const laterInterceptorInputs: OptimizationSelectionState[] = []

    stateInterceptors.add(() => ({ profile: interceptedProfile }))
    stateInterceptors.add((incoming) => {
      laterInterceptorInputs.push(incoming)
      return { changes: interceptedChanges }
    })

    await applyOptimizationDataToSignals(optimizationData, stateInterceptors)

    expect(laterInterceptorInputs).toEqual([
      {
        changes: changesFixture,
        profile: interceptedProfile,
        selectedOptimizations: selectedOptimizationsFixture,
      },
    ])
    expect(changes.value).toEqual(interceptedChanges)
    expect(profile.value).toEqual(interceptedProfile)
    expect(selectedOptimizations.value).toEqual(selectedOptimizationsFixture)
    expect(experienceRequestState.value).toEqual({ status: 'success' })
  })

  it('applies present undefined fields intentionally', async () => {
    const stateInterceptors = new InterceptorManager<OptimizationSelectionState>()
    selectedOptimizations.value = selectedOptimizationsFixture
    stateInterceptors.add((incoming) => ({
      ...incoming,
      selectedOptimizations: undefined,
    }))

    await applyOptimizationDataToSignals(optimizationData, stateInterceptors)

    expect(changes.value).toEqual(changesFixture)
    expect(profile.value).toEqual(profileFixture)
    expect(selectedOptimizations.value).toBeUndefined()
    expect(experienceRequestState.value).toEqual({ status: 'success' })
  })
})
