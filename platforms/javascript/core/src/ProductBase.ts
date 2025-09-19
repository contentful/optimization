import type ApiClient from './lib/api-client'
import type { OptimizationData } from './lib/api-client'
import type { EventBuilder } from './lib/api-client/builders'
import { InterceptorManager } from './lib/interceptor'
import { consent } from './signals'

export interface ConsentGuard {
  // TODO: Determine whether these methods can be hard-private
  hasConsent: () => boolean
  onBlockedByConsent: (name: string, args: unknown[]) => void
}

interface InterceptorLifecycle<E> {
  event: InterceptorManager<E>
  state: InterceptorManager<OptimizationData>
}

abstract class ProductBase<E> implements ConsentGuard {
  protected readonly builder: EventBuilder
  protected readonly api: ApiClient

  readonly interceptor: InterceptorLifecycle<E> = {
    event: new InterceptorManager<E>(),
    state: new InterceptorManager<OptimizationData>(),
  }

  constructor(api: ApiClient, builder: EventBuilder) {
    this.api = api
    this.builder = builder
  }

  hasConsent(): boolean {
    return !!consent.value
  }

  abstract onBlockedByConsent(name: string, args: unknown[]): void
}

export default ProductBase
