import type ApiClient from '@contentful/optimization-api-client'
import type {
  InsightsEventType as AnalyticsEventType,
  EventBuilder,
  OptimizationData,
  ExperienceEventType as PersonalizationEventType,
} from '@contentful/optimization-api-client'
import { InterceptorManager } from './lib/interceptor'

export type EventType = AnalyticsEventType | PersonalizationEventType

const defaultAllowedEvents: EventType[] = ['page', 'identify']

export interface ProductConfig {
  allowedEvents?: EventType[]
}

interface InterceptorLifecycle<E> {
  event: InterceptorManager<E>
  state: InterceptorManager<OptimizationData>
}

abstract class ProductBase<E> {
  protected readonly allowedEvents?: string[]
  protected readonly builder: EventBuilder
  protected readonly api: ApiClient

  readonly interceptor: InterceptorLifecycle<E> = {
    event: new InterceptorManager<E>(),
    state: new InterceptorManager<OptimizationData>(),
  }

  constructor(api: ApiClient, builder: EventBuilder, config?: ProductConfig) {
    this.api = api
    this.builder = builder
    this.allowedEvents = config?.allowedEvents ?? defaultAllowedEvents
  }
}

export default ProductBase
