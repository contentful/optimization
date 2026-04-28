import type {
  OptimizationData,
  Profile,
  SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import { signal, type Signal } from '@preact/signals-core'
import { InterceptorManager } from '../lib/interceptor'
import { PreviewOverrideManager } from './PreviewOverrideManager'
import { BASELINE, makeOptimizationData } from './PreviewOverrideManager.test-utils'

function makeProfile(qualifiedAudiences: string[]): Profile {
  const { profile } = makeOptimizationData(BASELINE)
  return { ...profile, audiences: qualifiedAudiences }
}

interface Harness {
  manager: PreviewOverrideManager
  profileSignal: Signal<Profile | undefined>
  selectedOptimizations: Signal<SelectedOptimizationArray | undefined>
}

function createHarness(initialProfile: Profile | undefined): Harness {
  const profileSignal = signal<Profile | undefined>(initialProfile)
  const selectedOptimizations = signal<SelectedOptimizationArray | undefined>(BASELINE)
  const stateInterceptors = new InterceptorManager<OptimizationData>()
  const manager = new PreviewOverrideManager({
    selectedOptimizations,
    profile: profileSignal,
    stateInterceptors,
    onOverridesChanged: rs.fn(),
  })
  return { manager, profileSignal, selectedOptimizations }
}

describe('PreviewOverrideManager — audience qualification baseline', () => {
  let manager: PreviewOverrideManager | undefined

  afterEach(() => {
    manager?.destroy()
    manager = undefined
  })

  it('starts empty when no audience has been overridden yet', () => {
    const h = createHarness(makeProfile(['aud-1']))
    manager = h.manager
    expect(manager.getBaselineAudienceQualifications()).toEqual({})
  })

  it('activateAudience captures profile.audiences membership as the snapshot', () => {
    const h = createHarness(makeProfile(['aud-qualified']))
    manager = h.manager

    manager.activateAudience('aud-qualified', ['exp-1'])
    manager.activateAudience('aud-unqualified', ['exp-2'])

    expect(manager.getBaselineAudienceQualifications()).toEqual({
      'aud-qualified': true,
      'aud-unqualified': false,
    })
  })

  it('deactivateAudience captures profile.audiences membership as the snapshot', () => {
    const h = createHarness(makeProfile(['aud-1']))
    manager = h.manager

    manager.deactivateAudience('aud-1', ['exp-1'])
    expect(manager.getBaselineAudienceQualifications()).toEqual({ 'aud-1': true })
  })

  it('does not update the snapshot on subsequent overrides of the same audience', () => {
    const h = createHarness(makeProfile([])) // aud-1 initially unqualified
    manager = h.manager

    manager.activateAudience('aud-1', ['exp-1'])
    expect(manager.getBaselineAudienceQualifications()['aud-1']).toBe(false)

    // Even if profile membership later changes, or the user flips their override
    // several times, the snapshot reflects the *original* pre-override state.
    h.profileSignal.value = makeProfile(['aud-1'])
    manager.deactivateAudience('aud-1', ['exp-1'])
    manager.activateAudience('aud-1', ['exp-1'])

    expect(manager.getBaselineAudienceQualifications()['aud-1']).toBe(false)
  })

  it('resetAudienceOverride removes the snapshot entry for that audience', () => {
    const h = createHarness(makeProfile(['aud-1']))
    manager = h.manager

    manager.activateAudience('aud-1', ['exp-1'])
    manager.activateAudience('aud-2', ['exp-2'])
    expect(manager.getBaselineAudienceQualifications()).toEqual({
      'aud-1': true,
      'aud-2': false,
    })

    manager.resetAudienceOverride('aud-1')
    expect(manager.getBaselineAudienceQualifications()).toEqual({ 'aud-2': false })
  })

  it('resetAll clears all snapshots', () => {
    const h = createHarness(makeProfile(['aud-1']))
    manager = h.manager

    manager.activateAudience('aud-1', ['exp-1'])
    manager.activateAudience('aud-2', ['exp-2'])
    expect(Object.keys(manager.getBaselineAudienceQualifications())).toHaveLength(2)

    manager.resetAll()
    expect(manager.getBaselineAudienceQualifications()).toEqual({})
  })

  it('destroy clears all snapshots', () => {
    const h = createHarness(makeProfile(['aud-1']))
    manager = h.manager

    manager.activateAudience('aud-1', ['exp-1'])
    manager.destroy()

    expect(manager.getBaselineAudienceQualifications()).toEqual({})
    manager = undefined // prevent afterEach double-destroy
  })

  it('treats profile.value = undefined as "not qualified"', () => {
    const h = createHarness(undefined)
    manager = h.manager

    manager.activateAudience('aud-1', ['exp-1'])
    expect(manager.getBaselineAudienceQualifications()).toEqual({ 'aud-1': false })
  })

  it('is a no-op when no profile signal was provided (backward compat)', () => {
    const selectedOptimizations = signal<SelectedOptimizationArray | undefined>(BASELINE)
    const stateInterceptors = new InterceptorManager<OptimizationData>()
    const mgr = new PreviewOverrideManager({
      selectedOptimizations,
      stateInterceptors,
      onOverridesChanged: rs.fn(),
    })

    mgr.activateAudience('aud-1', ['exp-1'])
    expect(mgr.getBaselineAudienceQualifications()).toEqual({})

    mgr.destroy()
  })
})
