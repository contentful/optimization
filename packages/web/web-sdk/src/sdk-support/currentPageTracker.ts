import type { PageViewBuilderArgs } from '@contentful/optimization-core'
import type { EventEmissionResult } from '@contentful/optimization-core/sdk-support'
import {
  AcceptedCurrentStateTracker,
  pageWithEmissionResult,
} from '@contentful/optimization-core/sdk-support'

export interface CurrentPageEmissionMetadata {
  readonly isInitialEmission: boolean
}

export interface CurrentPageTrackerSdk {
  readonly hasConsent: (name: string) => boolean
}

export interface CurrentPageTrackerSdkSupport {
  readonly pageWithEmissionResult: (payload?: PageViewBuilderArgs) => Promise<EventEmissionResult>
}

export interface EmitCurrentPageOptions {
  readonly buildPayload: (metadata: CurrentPageEmissionMetadata) => PageViewBuilderArgs | undefined
  readonly routeKey: string
}

export class CurrentPageTracker {
  private readonly tracker = new AcceptedCurrentStateTracker<string>()

  async emitIfNeeded(
    sdk: CurrentPageTrackerSdk,
    { buildPayload, routeKey }: EmitCurrentPageOptions,
  ): Promise<void> {
    const isInitialEmission = !this.tracker.hasAccepted()

    await this.tracker.emitIfNeeded({
      key: routeKey,
      isAllowed: sdk.hasConsent('page'),
      emit: async () => {
        const payload = buildPayload({ isInitialEmission }) ?? {}

        const support = currentPageTrackerSdkSupportBySdk.get(sdk)

        if (support) {
          return await support.pageWithEmissionResult(payload)
        }

        return await pageWithEmissionResult(sdk, payload)
      },
    })
  }

  reset(): void {
    this.tracker.reset()
  }
}

let currentPageTrackerBySdk = new WeakMap<object, CurrentPageTracker>()
let currentPageTrackerSdkSupportBySdk = new WeakMap<object, CurrentPageTrackerSdkSupport>()

export function getCurrentPageTracker(sdk: object): CurrentPageTracker {
  let tracker = currentPageTrackerBySdk.get(sdk)

  if (tracker === undefined) {
    tracker = new CurrentPageTracker()
    currentPageTrackerBySdk.set(sdk, tracker)
  }

  return tracker
}

export function resetCurrentPageTrackerState(): void {
  currentPageTrackerBySdk = new WeakMap<object, CurrentPageTracker>()
  currentPageTrackerSdkSupportBySdk = new WeakMap<object, CurrentPageTrackerSdkSupport>()
}

export function installCurrentPageTrackerSdkSupport(
  sdk: object,
  support: CurrentPageTrackerSdkSupport,
): void {
  currentPageTrackerSdkSupportBySdk.set(sdk, support)
}
