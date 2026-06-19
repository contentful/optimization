import type { PartialProfile } from '../api-schemas'
import type { EventEmissionResult } from '../EventEmissionResult'
import type { PageViewBuilderArgs, ScreenViewBuilderArgs } from '../events'

export interface CoreStatefulSdkSupport {
  pageWithEmissionResult: (
    payload?: PageViewBuilderArgs & { profile?: PartialProfile },
  ) => Promise<EventEmissionResult>
  screenWithEmissionResult: (
    payload: ScreenViewBuilderArgs & { profile?: PartialProfile },
  ) => Promise<EventEmissionResult>
}

const coreStatefulSdkSupportByInstance = new WeakMap<object, CoreStatefulSdkSupport>()

/**
 * Register first-party SDK support access for a CoreStateful-compatible instance.
 *
 * @internal
 */
export function installCoreStatefulSdkSupport(core: object, support: CoreStatefulSdkSupport): void {
  coreStatefulSdkSupportByInstance.set(core, support)
}

function getCoreStatefulSdkSupport(core: object): CoreStatefulSdkSupport {
  const support = coreStatefulSdkSupportByInstance.get(core)

  if (support === undefined) {
    throw new Error('CoreStateful SDK support is unavailable for this instance.')
  }

  return support
}

export async function pageWithEmissionResult(
  core: object,
  payload: PageViewBuilderArgs & { profile?: PartialProfile } = {},
): Promise<EventEmissionResult> {
  return await getCoreStatefulSdkSupport(core).pageWithEmissionResult(payload)
}

export async function screenWithEmissionResult(
  core: object,
  payload: ScreenViewBuilderArgs & { profile?: PartialProfile },
): Promise<EventEmissionResult> {
  return await getCoreStatefulSdkSupport(core).screenWithEmissionResult(payload)
}
