import type {
  ClickBuilderArgs,
  FlagViewBuilderArgs,
  HoverBuilderArgs,
  ViewBuilderArgs,
} from '../events'
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
  abstract trackView(payload: ViewBuilderArgs): Promise<void> | void

  /**
   * Track a UI component click event.
   *
   * @param payload - Component click builder arguments.
   * @returns A promise that resolves when processing is complete (or `void`).
   */
  abstract trackClick(payload: ClickBuilderArgs): Promise<void> | void

  /**
   * Track a UI component hover event.
   *
   * @param payload - Component hover builder arguments.
   * @returns A promise that resolves when processing is complete (or `void`).
   */
  abstract trackHover(payload: HoverBuilderArgs): Promise<void> | void

  /**
   * Track a flag (feature) view event.
   *
   * @param payload - Flag view builder arguments.
   * @returns A promise that resolves when processing is complete (or `void`).
   */
  abstract trackFlagView(payload: FlagViewBuilderArgs): Promise<void> | void
}

export default AnalyticsBase
