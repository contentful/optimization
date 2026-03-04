import type { ApiClient, EventBuilder } from '@contentful/optimization-api-client'
import type {
  InsightsEventType as AnalyticsEventType,
  ExperienceEventType as PersonalizationEventType,
} from '@contentful/optimization-api-client/api-schemas'
import { createScopedLogger } from '@contentful/optimization-api-client/logger'
import type { BlockedEvent, BlockedEventProduct, BlockedEventReason } from './BlockedEvent'
import type { LifecycleInterceptors } from './CoreBase'
import { blockedEvent } from './signals'

const logger = createScopedLogger('ProductBase')

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
const defaultAllowedEvents: EventType[] = ['identify', 'page', 'screen']

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
   * @defaultValue `['identify', 'page', 'screen']`
   * @remarks These types are compared against the `type` property of events.
   */
  allowedEventTypes?: EventType[]

  /**
   * Callback invoked whenever an event call is blocked by guards.
   *
   * @remarks
   * This callback is best-effort. Any exception thrown by the callback is
   * swallowed to keep event handling fault tolerant.
   */
  onEventBlocked?: (event: BlockedEvent) => void
}

/**
 * Options for configuring the common functionality of {@link ProductBase} descendents.
 *
 * @public
 */
export interface ProductBaseOptions {
  /** Optimization API client. */
  api: ApiClient
  /** Event builder for constructing events. */
  builder: EventBuilder
  /** Optional configuration for allow‑lists and guard callbacks. */
  config?: ProductConfig
  /** Lifecycle container for event and state interceptors. */
  interceptors: LifecycleInterceptors
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
abstract class ProductBase {
  /**
   * Allow‑list of event {@link AnalyticsEventType | type keys} permitted when consent is not present.
   */
  protected readonly allowedEventTypes?: string[]

  /** Event builder used to construct strongly‑typed events. */
  protected readonly builder: EventBuilder

  /** Optimization API client used to send events to the Experience and Insights APIs. */
  protected readonly api: ApiClient

  /** Interceptors that can mutate/augment outgoing events or optimization state. */
  readonly interceptors: LifecycleInterceptors

  /** Optional callback invoked when an event call is blocked. */
  protected readonly onEventBlocked?: ProductConfig['onEventBlocked']

  /**
   * Creates a new product base instance.
   *
   * @param options - Options for configuring the functionality common among products.
   */
  constructor(options: ProductBaseOptions) {
    const { api, builder, config, interceptors } = options
    this.allowedEventTypes = config?.allowedEventTypes ?? defaultAllowedEvents
    this.api = api
    this.builder = builder
    this.interceptors = interceptors
    this.onEventBlocked = config?.onEventBlocked
  }

  /**
   * Publish blocked event metadata to both callback and blocked event signal.
   *
   * @param reason - Reason the method call was blocked.
   * @param product - Product that blocked the method call.
   * @param method - Name of the blocked method.
   * @param args - Original blocked call arguments.
   */
  protected reportBlockedEvent(
    reason: BlockedEventReason,
    product: BlockedEventProduct,
    method: string,
    args: readonly unknown[],
  ): void {
    const event: BlockedEvent = { reason, product, method, args }

    try {
      this.onEventBlocked?.(event)
    } catch (error) {
      logger.warn(`onEventBlocked callback failed for method "${method}"`, error)
    }

    blockedEvent.value = event
  }
}

export default ProductBase
