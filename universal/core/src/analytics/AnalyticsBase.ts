import type { InsightsEvent as AnalyticsEvent } from '@contentful/optimization-api-client'
import ProductBase from '../ProductBase'

abstract class AnalyticsBase extends ProductBase<AnalyticsEvent> {
  abstract trackComponentView(...args: unknown[]): Promise<void> | void
  abstract trackFlagView(...args: unknown[]): Promise<void> | void
}

export default AnalyticsBase
