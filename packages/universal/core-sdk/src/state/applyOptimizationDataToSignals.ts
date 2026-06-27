import type { OptimizationData } from '@contentful/optimization-api-client/api-schemas'
import { isEqual } from 'es-toolkit/predicate'
import type { LifecycleInterceptors } from '../CoreBase'
import {
  batch,
  changes as changesSignal,
  experienceRequestState as experienceRequestStateSignal,
  profile as profileSignal,
  selectedOptimizations as selectedOptimizationsSignal,
} from '../signals'

export async function applyOptimizationDataToSignals(
  data: OptimizationData,
  stateInterceptors: LifecycleInterceptors['state'],
): Promise<void> {
  const intercepted = await stateInterceptors.run(data)
  const { changes, profile, selectedOptimizations } = intercepted

  // success must be written inside this batch because experienceRequestState transitions
  // to 'success' atomically with selectedOptimizations so consumers never observe
  // a render where !pending is true but canOptimize is still false
  batch(() => {
    if (!isEqual(changesSignal.value, changes)) changesSignal.value = changes
    if (!isEqual(profileSignal.value, profile)) profileSignal.value = profile
    if (!isEqual(selectedOptimizationsSignal.value, selectedOptimizations)) {
      selectedOptimizationsSignal.value = selectedOptimizations
    }
    experienceRequestStateSignal.value = { status: 'success' }
  })
}
