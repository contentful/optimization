import type ApiClient from '@contentful/optimization-api-client'
import type {
  InsightsEventType as AnalyticsEventType,
  EventBuilder,
  OptimizationData,
  ExperienceEventType as PersonalizationEventType,
} from '@contentful/optimization-api-client'
import { InterceptorManager } from './lib/interceptor'
import ValuePresence from './lib/value-presence/ValuePresence'

/**
 * Union of all event {@link AnalyticsEventType | type keys} that this package may emit.
 *
 * @public
 */
export type EventType = AnalyticsEventType | PersonalizationEventType

/**
 * Default allow‑list of event types that can be emitted without explicit consent.
 *
 * @internal
 * @privateRemarks These defaults are only applied when a consumer does not provide
 * {@link ProductConfig.allowedEventTypes}.
 */
const defaultAllowedEvents: EventType[] = ['page', 'identify']

/**
 * Common configuration for all product implementations.
 *
 * @public
 */
export interface ProductConfig {
  /**
   * The set of event type strings that are allowed to be sent even if consent is
   * not granted.
   *
   * @defaultValue `['page', 'identify']`
   * @remarks These types are compared against the `type` property of events.
   */
  allowedEventTypes?: EventType[]

  /**
   * A map of duplication keys to a list of component IDs that should be
   * considered duplicates and therefore suppressed.
   *
   * @remarks
   * The actual duplication check is performed by {@link ValuePresence}. The
   * keys of this record are used as duplication scopes. An empty string `''`
   * is converted to an `indefined` scope when specific scopes are not required.
   */
  preventedComponentEvents?: Record<string, string[]>
}

/**
 * Lifecycle container for event and state interceptors.
 *
 * @internal
 */
interface InterceptorLifecycle<E> {
  /** Interceptors invoked for individual events prior to validation/sending. */
  event: InterceptorManager<E>
  /** Interceptors invoked before optimization state updates. */
  state: InterceptorManager<OptimizationData>
}

/**
 * Shared base for all product implementations.
 *
 * @internal
 * @remarks
 * This abstract class is not exported as part of the public API surface.
 * Concrete implementations (e.g., analytics) should extend this class and
 * expose their own public methods.
 */
abstract class ProductBase<E> {
  /**
   * Allow‑list of event {@link AnalyticsEventType | type keys} permitted when consent is not present.
   */
  protected readonly allowedEventTypes?: string[]

  /** Event builder used to construct strongly‑typed events. */
  protected readonly builder: EventBuilder

  /** Optimization API client used to send events to the Experience and Insights APIs. */
  protected readonly api: ApiClient

  /**
   * Deduplication helper used to track previously seen values within optional
   * scopes
   */
  readonly duplicationDetector: ValuePresence

  /** Interceptors that can mutate/augment outgoing events or optimization state. */
  readonly interceptor: InterceptorLifecycle<E> = {
    event: new InterceptorManager<E>(),
    state: new InterceptorManager<OptimizationData>(),
  }

  /**
   * Creates a new product base instance.
   *
   * @param api - Optimization API client.
   * @param builder - Event builder for constructing events.
   * @param config - Optional configuration for allow‑lists and duplication prevention.
   */
  constructor(api: ApiClient, builder: EventBuilder, config?: ProductConfig) {
    this.api = api
    this.builder = builder
    this.allowedEventTypes = config?.allowedEventTypes ?? defaultAllowedEvents
    this.duplicationDetector = new ValuePresence(config?.preventedComponentEvents)
  }
}

export default ProductBase
