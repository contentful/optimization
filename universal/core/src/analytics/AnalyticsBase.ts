import type { ComponentViewBuilderArgs } from '@contentful/optimization-api-client'
import ProductBase from '../ProductBase'

/**
 * Base class for analytics implementations (internal).
 *
 * @internal
 * @remarks
 * Concrete analytics classes should implement the component/flag view tracking
 * methods below. This base is not part of the public API.
 */
abstract class AnalyticsBase extends ProductBase {
  /**
   * Track a UI component view event.
   *
   * @param payload - Component view builder arguments.
   * @returns A promise that resolves when processing is complete (or `void`).
   */
  abstract trackComponentView(payload: ComponentViewBuilderArgs): Promise<void> | void

  /**
   * Track a UI component click event.
   *
   * @param payload - Component click builder arguments.
   * @returns A promise that resolves when processing is complete (or `void`).
   */
  abstract trackComponentClick(payload: ComponentViewBuilderArgs): Promise<void> | void

  /**
   * Track a flag (feature) view event.
   *
   * @param payload - Flag view builder arguments.
   * @returns A promise that resolves when processing is complete (or `void`).
   */
  abstract trackFlagView(payload: ComponentViewBuilderArgs): Promise<void> | void
}

export default AnalyticsBase
