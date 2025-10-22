import type ApiClient from '@contentful/optimization-api-client'
import type {
  InsightsEventType as AnalyticsEventType,
  EventBuilder,
  OptimizationData,
  ExperienceEventType as PersonalizationEventType,
} from '@contentful/optimization-api-client'
import { InterceptorManager } from './lib/interceptor'
import { consent } from './signals'

export type EventType = AnalyticsEventType | PersonalizationEventType

const defaultAllowedEvents: EventType[] = ['page', 'identify']

export interface ConsentGuard {
  // TODO: Determine whether these methods can be hard-private
  hasConsent: (name: string) => boolean
  onBlockedByConsent: (name: string, args: unknown[]) => void
}

export interface ProductConfig {
  allowedEvents?: EventType[]
}

interface InterceptorLifecycle<E> {
  event: InterceptorManager<E>
  state: InterceptorManager<OptimizationData>
}

abstract class ProductBase<E> implements ConsentGuard {
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

  hasConsent(name: string): boolean {
    return !!consent.value || (this.allowedEvents ?? []).includes(name)
  }

  abstract onBlockedByConsent(name: string, args: unknown[]): void
}

export default ProductBase
