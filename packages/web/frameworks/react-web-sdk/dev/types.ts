export interface DatasetSnapshot {
  ctflEntryId?: string
  ctflPersonalizationId?: string
  ctflVariantIndex?: string
  ctflSticky?: string
  ctflDuplicationScope?: string
}

export interface ResolveResult {
  baselineId: string
  resolvedId: string
  personalizationId?: string
  variantIndex?: number
  sticky?: boolean
}
