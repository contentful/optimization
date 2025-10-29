import type ApiClient from '@contentful/optimization-api-client'
import type {
  InsightsEventType as AnalyticsEventType,
  ComponentViewBuilderArgs,
  EventBuilder,
  OptimizationData,
  ExperienceEventType as PersonalizationEventType,
} from '@contentful/optimization-api-client'
import { InterceptorManager } from './lib/interceptor'
import ValuePresence from './lib/value-presence/ValuePresence'

export type EventType = AnalyticsEventType | PersonalizationEventType

const defaultAllowedEvents: EventType[] = ['page', 'identify']

export interface ProductConfig {
  allowedEventTypes?: EventType[]
  preventedComponentEvents?: Record<string, ComponentViewBuilderArgs[]>
}

interface InterceptorLifecycle<E> {
  event: InterceptorManager<E>
  state: InterceptorManager<OptimizationData>
}

abstract class ProductBase<E> {
  protected readonly allowedEventTypes?: string[]
  protected readonly builder: EventBuilder
  protected readonly api: ApiClient
  protected readonly duplicationDetector: ValuePresence

  readonly interceptor: InterceptorLifecycle<E> = {
    event: new InterceptorManager<E>(),
    state: new InterceptorManager<OptimizationData>(),
  }

  constructor(api: ApiClient, builder: EventBuilder, config?: ProductConfig) {
    this.api = api
    this.builder = builder
    this.allowedEventTypes = config?.allowedEventTypes ?? defaultAllowedEvents
    this.duplicationDetector = new ValuePresence(config?.preventedComponentEvents)
  }
}

export default ProductBase
