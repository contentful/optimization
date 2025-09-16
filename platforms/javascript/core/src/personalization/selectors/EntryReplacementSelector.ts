import {
  isEntryReplacementComponent,
  type EntryReplacementComponent,
  type EntryReplacementVariant,
} from '../mappers/entry'
import type { OptimizationConfig } from '../mappers/optimization'

const EntryReplacementSelector = {
  hasVariants(config: OptimizationConfig, baseline: EntryReplacementVariant): boolean {
    return EntryReplacementSelector.selectVariants(config, baseline).length > 0
  },

  selectVariants(
    config: OptimizationConfig,
    baseline: EntryReplacementVariant,
  ): EntryReplacementVariant[] {
    return EntryReplacementSelector.selectBaselineWithVariants(config, baseline)?.variants ?? []
  },

  selectBaselineWithVariants(
    config: OptimizationConfig,
    baseline: EntryReplacementVariant,
  ): EntryReplacementComponent | undefined {
    return config.components
      .filter(isEntryReplacementComponent)
      .find((component) => component.baseline.id && component.baseline.id === baseline.id)
  },
}

export default EntryReplacementSelector
