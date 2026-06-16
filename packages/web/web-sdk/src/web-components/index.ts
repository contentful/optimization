import { ContentfulOptimizationRootElement } from './ContentfulOptimizationRootElement'
import { ContentfulOptimizedEntryElement } from './ContentfulOptimizedEntryElement'

const DEFAULT_ROOT_TAG_NAME = 'ctfl-optimization-root'
const DEFAULT_OPTIMIZED_ENTRY_TAG_NAME = 'ctfl-optimized-entry'

export interface DefineContentfulOptimizationElementsOptions {
  readonly optimizedEntryTagName?: string
  readonly registry?: CustomElementRegistry
  readonly rootTagName?: string
}

function getDefaultCustomElementRegistry(): CustomElementRegistry {
  if (typeof customElements === 'undefined') {
    throw new Error('Custom elements are not available in this environment.')
  }

  return customElements
}

export function defineContentfulOptimizationElements(
  options: DefineContentfulOptimizationElementsOptions = {},
): void {
  const registry = options.registry ?? getDefaultCustomElementRegistry()
  const rootTagName = options.rootTagName ?? DEFAULT_ROOT_TAG_NAME
  const optimizedEntryTagName = options.optimizedEntryTagName ?? DEFAULT_OPTIMIZED_ENTRY_TAG_NAME

  if (!registry.get(rootTagName)) {
    const RootElement =
      rootTagName === DEFAULT_ROOT_TAG_NAME
        ? ContentfulOptimizationRootElement
        : class extends ContentfulOptimizationRootElement {}

    registry.define(rootTagName, RootElement)
  }

  if (!registry.get(optimizedEntryTagName)) {
    const OptimizedEntryElement =
      optimizedEntryTagName === DEFAULT_OPTIMIZED_ENTRY_TAG_NAME
        ? ContentfulOptimizedEntryElement
        : class extends ContentfulOptimizedEntryElement {}

    registry.define(optimizedEntryTagName, OptimizedEntryElement)
  }
}

export {
  ContentfulOptimizationRootElement,
  type ContentfulOptimizationRootContext,
  type ContentfulOptimizationRootErrorEventDetail,
  type ContentfulOptimizationRootReadyEventDetail,
} from './ContentfulOptimizationRootElement'
export {
  ContentfulOptimizedEntryElement,
  type ContentfulOptimizedEntryErrorEventDetail,
  type ContentfulOptimizedEntryEventDetail,
} from './ContentfulOptimizedEntryElement'
