import type { OptimizationData, PartialProfile } from './api-schemas'
import type { CoreStatelessInsightsOptions, CoreStatelessRequestOptions } from './CoreStateless'
import type {
  EventBuilder,
  IdentifyBuilderArgs,
  PageViewBuilderArgs,
  TrackBuilderArgs,
  UniversalEventBuilderArgs,
  ViewBuilderArgs,
} from './events'
import type { OptimizationHandoff } from './handoff'

/**
 * Request-scoped consent accepted by stateless request clients.
 *
 * @public
 */
export type CoreStatelessRequestConsent =
  | boolean
  | {
      /** Whether consent permits Experience and Insights events for this request. */
      events?: boolean
      /** Whether the host application may persist profile continuity for this request. */
      persistence?: boolean
    }

/**
 * Personalization event construction with request context applied before building.
 *
 * @remarks
 * Building does not submit events or apply request consent and submission processing.
 *
 * @public
 */
export type CoreStatelessRequestEventBuilder = Readonly<
  Pick<EventBuilder, 'buildIdentify' | 'buildPageView' | 'buildScreenView' | 'buildTrack'>
>

/**
 * Options used to bind stateless SDK calls to an incoming request.
 *
 * @public
 */
export interface CoreStatelessForRequestOptions {
  /** A boolean applies to both event and persistence consent; use an object to set them independently. */
  consent: CoreStatelessRequestConsent
  /**
   * Request-scoped SDK locale used for Experience API requests, default event context, and
   * SDK-managed Contentful entry fetching when no Contentful query locale is configured.
   */
  locale?: string
  /** Profile already known for the request, such as an API-issued ID read from a cookie. */
  profile?: PartialProfile
  /** Universal event context shared by event calls made through this request object. */
  eventContext?: UniversalEventBuilderArgs
  /** Experience API options shared by Experience calls made through this request object. */
  experienceOptions?: CoreStatelessRequestOptions
  /** Insights API options shared by Insights calls made through this request object. */
  insightsOptions?: CoreStatelessInsightsOptions
}

/**
 * Payload accepted by request-bound Experience methods.
 *
 * @typeParam TPayload - Event-builder arguments for the specific method.
 *
 * @public
 */
export type StatelessExperiencePayload<TPayload> = TPayload

/**
 * Payload accepted by request-bound Insights methods.
 *
 * @typeParam TPayload - Event-builder arguments for the specific method.
 *
 * @public
 */
export type StatelessInsightsPayload<TPayload> = TPayload

/**
 * Sticky request-bound view-tracking payload.
 *
 * @public
 */
export type StatelessStickyTrackViewPayload = ViewBuilderArgs & {
  sticky: true
}

/**
 * Non-sticky request-bound view-tracking payload.
 *
 * @public
 */
export type StatelessNonStickyTrackViewPayload = Omit<ViewBuilderArgs, 'sticky'> & {
  sticky?: false | undefined
}

export type InitialExperienceEvent =
  | ({ readonly type: 'identify' } & IdentifyBuilderArgs)
  | ({ readonly type: 'track' } & TrackBuilderArgs)

export interface PrepareRequestHandoffOptions {
  /** Pathname and search string used to match the browser's initial route. Must start with `/`. */
  readonly routeKey: string
  /** Consent-permitted identify and track events to place before the initial page event. */
  readonly initialEvents?: readonly InitialExperienceEvent[]
  /** Optional initial page properties; request-bound page context supplies defaults. */
  readonly page?: PageViewBuilderArgs
}

export interface PrepareRequestHandoffResult {
  /** Private-request handoff containing the prepared replay when input validation and consent allow it. */
  readonly handoff: OptimizationHandoff
  /** Optimization data returned by the Experience preview, or `undefined` when preview fails. */
  readonly data?: OptimizationData
}
