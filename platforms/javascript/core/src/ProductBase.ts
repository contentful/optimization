import type ApiClient from './lib/api-client'
import type { OptimizationDataType } from './lib/api-client'
import type { EventBuilder } from './lib/builders'
import { InterceptorManager } from './lib/interceptor'
import { consent } from './signals'

export interface ConsentGuard {
  // TODO: Determine whether these methods can be hard-private
  hasNoConsent: () => boolean
  onBlockedByConsent: (name: string, args: unknown[]) => void
}

interface InterceptorLifecycle<E> {
  event: InterceptorManager<E>
  state: InterceptorManager<OptimizationDataType>
}

abstract class ProductBase<E> implements ConsentGuard {
  protected readonly builder: EventBuilder
  protected readonly api: ApiClient

  readonly interceptor: InterceptorLifecycle<E> = {
    event: new InterceptorManager<E>(),
    state: new InterceptorManager<OptimizationDataType>(),
  }

  constructor(api: ApiClient, builder: EventBuilder) {
    this.api = api
    this.builder = builder
  }

  hasNoConsent(): boolean {
    return !consent.value
  }

  abstract onBlockedByConsent(name: string, args: unknown[]): void
}

export default ProductBase
