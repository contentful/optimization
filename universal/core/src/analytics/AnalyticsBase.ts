import type {
  InsightsEvent as AnalyticsEvent,
  ComponentViewBuilderArgs,
} from '@contentful/optimization-api-client'
import ProductBase from '../ProductBase'

/**
 * Base class for analytics implementations (internal).
 *
 * @internal
 * @remarks
 * Concrete analytics classes should implement the component/flag view tracking
 * methods below. This base is not part of the public API.
 */
abstract class AnalyticsBase extends ProductBase<AnalyticsEvent> {
  /**
   * Track a UI component view event.
   *
   * @param payload - Component view builder arguments.
   * @param duplicationScope - Optional string used to scope duplication used in Stateful
   * implementations.
   * @privateRemarks
   * Duplication prevention should be handled in Stateful implementations
   */
  abstract trackComponentView(
    payload: ComponentViewBuilderArgs,
    duplicationScope?: string,
  ): Promise<void> | void

  /**
   * Track a flag (feature) view event.
   *
   * @param payload - Flag view builder arguments.
   * @param duplicationScope - Optional string used to scope duplication used in Stateful
   * implementations.
   * @returns A promise that resolves when processing is complete (or `void`).
   * @privateRemarks
   * Duplication prevention should be handled in Stateful implementations
   */
  abstract trackFlagView(
    payload: ComponentViewBuilderArgs,
    duplicationScope?: string,
  ): Promise<void> | void
}

export default AnalyticsBase
