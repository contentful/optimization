import type { Entry, OptimizedEntry } from '../mappers/entry'
import {
  isEntryVariantComponent,
  type EntryVariantComponent,
  type OptimizationConfig,
} from '../mappers/optimization'

const EntryReplacementSelector = {
  hasVariants(config: OptimizationConfig, baseline: OptimizedEntry): boolean {
    return EntryReplacementSelector.selectRelevantVariants(config, baseline).length > 0
  },

  selectRelevantVariants(config: OptimizationConfig, baseline: OptimizedEntry): Entry[] {
    return EntryReplacementSelector.selectBaselineWithVariants(config, baseline)?.variants ?? []
  },

  selectBaselineWithVariants(
    config: OptimizationConfig,
    baseline: OptimizedEntry,
  ): EntryVariantComponent | undefined {
    return config.components
      .filter(isEntryVariantComponent)
      .find((component) => component.baseline.id && component.baseline.id === baseline.sys.id)
  },
}

export default EntryReplacementSelector
