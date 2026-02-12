export interface CapabilityMappingEntry {
  capabilityName: string
  reactAccessPath: string
  parityStatus: 'full' | 'equivalent'
  notes?: string
}

export const capabilityMapping: CapabilityMappingEntry[] = [
  { capabilityName: 'consent', reactAccessPath: 'useOptimization().consent', parityStatus: 'full' },
  { capabilityName: 'reset', reactAccessPath: 'useOptimization().reset', parityStatus: 'full' },
  {
    capabilityName: 'startAutoTrackingEntryViews',
    reactAccessPath: 'useOptimization().startAutoTrackingEntryViews',
    parityStatus: 'full',
  },
  {
    capabilityName: 'stopAutoTrackingEntryViews',
    reactAccessPath: 'useOptimization().stopAutoTrackingEntryViews',
    parityStatus: 'full',
  },
  {
    capabilityName: 'trackEntryViewForElement',
    reactAccessPath: 'useOptimization().trackEntryViewForElement',
    parityStatus: 'full',
  },
  {
    capabilityName: 'untrackEntryViewForElement',
    reactAccessPath: 'useOptimization().untrackEntryViewForElement',
    parityStatus: 'full',
  },
  {
    capabilityName: 'getCustomFlag',
    reactAccessPath: 'useOptimization().getCustomFlag',
    parityStatus: 'full',
  },
  {
    capabilityName: 'personalizeEntry',
    reactAccessPath: 'useOptimization().personalizeEntry',
    parityStatus: 'full',
  },
  {
    capabilityName: 'getMergeTagValue',
    reactAccessPath: 'useOptimization().getMergeTagValue',
    parityStatus: 'full',
  },
  {
    capabilityName: 'identify',
    reactAccessPath: 'useOptimization().identify',
    parityStatus: 'full',
  },
  { capabilityName: 'page', reactAccessPath: 'useOptimization().page', parityStatus: 'full' },
  { capabilityName: 'track', reactAccessPath: 'useOptimization().track', parityStatus: 'full' },
  {
    capabilityName: 'trackComponentView',
    reactAccessPath: 'useOptimization().trackComponentView',
    parityStatus: 'full',
  },
  {
    capabilityName: 'trackFlagView',
    reactAccessPath: 'useOptimization().trackFlagView',
    parityStatus: 'full',
  },
]
