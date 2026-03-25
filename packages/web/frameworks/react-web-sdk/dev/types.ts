export interface DatasetSnapshot {
  ctflEntryId?: string
  ctflOptimizationId?: string
  ctflVariantIndex?: string
  ctflSticky?: string
  ctflDuplicationScope?: string
}

export interface ResolveResult {
  baselineId: string
  resolvedId: string
  optimizationId?: string
  variantIndex?: number
  sticky?: boolean
}
