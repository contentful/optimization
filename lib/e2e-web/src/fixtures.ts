export type EntryClickScenario = 'direct' | 'descendant' | 'ancestor'

export const CLICK_SCENARIOS: Record<string, EntryClickScenario> = {
  '4ib0hsHWoSOnCVdDkizE8d': 'direct',
  xFwgG3oNaOcjzWiGe4vXo: 'descendant',
  '2Z2WLOx07InSewC3LUB3eX': 'ancestor',
}

export const CLICK_SCENARIO_IDS: Record<EntryClickScenario, string> = {
  direct: '4ib0hsHWoSOnCVdDkizE8d',
  descendant: 'xFwgG3oNaOcjzWiGe4vXo',
  ancestor: '2Z2WLOx07InSewC3LUB3eX',
}

const pageTwoAuto = '2Z2WLOx07InSewC3LUB3eX' as const
const pageTwoManual = '5XHssysWUDECHzKLzoIsg1' as const

const homeAuto = [
  '1JAU028vQ7v6nB2swl3NBo',
  '1MwiFl4z7gkwqGYdvCmr8c',
  '4ib0hsHWoSOnCVdDkizE8d',
  'xFwgG3oNaOcjzWiGe4vXo',
  '2Z2WLOx07InSewC3LUB3eX',
] as const

const homeManual = [
  '5XHssysWUDECHzKLzoIsg1',
  '6zqoWXyiSrf0ja7I2WGtYj',
  '7pa5bOx8Z9NmNcr7mISvD',
] as const

export const PAGES = {
  home: {
    path: '/',
    ids: [...new Set([...homeAuto, ...homeManual])] as const,
    auto: homeAuto,
    manual: homeManual,
    liveUpdates: '2Z2WLOx07InSewC3LUB3eX' as const,
  },
  pageTwo: {
    path: '/page-two',
    ids: [pageTwoAuto, pageTwoManual] as const,
    auto: pageTwoAuto,
    manual: pageTwoManual,
  },
} as const

const CUSTOMER_SEGMENT_CACHE_VERSION = '0.1.0'
const CUSTOMER_SEGMENT_LOCALE = 'en-US'

interface CustomerSegmentInput {
  readonly baselineEntryId: string
  readonly experienceId: string
  readonly label: string
  readonly resolvedEntryText: string
  readonly selectedOptimizations: ReadonlyArray<{
    readonly experienceId: string
    readonly variantIndex: number
    readonly variants: Readonly<Record<string, string>>
  }>
  readonly slug: string
  readonly variantEntryId: string
}

function createCustomerSegment<const TSegment extends CustomerSegmentInput>(
  segment: TSegment,
): TSegment & {
  readonly baselineEntryIds: readonly [TSegment['baselineEntryId']]
  readonly cacheVersion: typeof CUSTOMER_SEGMENT_CACHE_VERSION
  readonly locale: typeof CUSTOMER_SEGMENT_LOCALE
} {
  const baselineEntryIds = [segment.baselineEntryId] as const

  return {
    ...segment,
    baselineEntryIds,
    cacheVersion: CUSTOMER_SEGMENT_CACHE_VERSION,
    locale: CUSTOMER_SEGMENT_LOCALE,
  }
}

export const CUSTOMER_SEGMENTS = {
  'new-visitor': createCustomerSegment({
    baselineEntryId: '2Z2WLOx07InSewC3LUB3eX',
    experienceId: '2cSY1TX0nDfYe4fuIrGQ1K',
    label: 'New visitors',
    resolvedEntryText: 'This is a variant content entry for new visitors.',
    slug: 'new-visitor',
    selectedOptimizations: [
      {
        experienceId: '2cSY1TX0nDfYe4fuIrGQ1K',
        variantIndex: 1,
        variants: {
          '2Z2WLOx07InSewC3LUB3eX': '1UFf7qr4mHET3HYuYmcpEj',
        },
      },
    ],
    variantEntryId: '1UFf7qr4mHET3HYuYmcpEj',
  }),
  baseline: createCustomerSegment({
    baselineEntryId: '2Z2WLOx07InSewC3LUB3eX',
    experienceId: '2cSY1TX0nDfYe4fuIrGQ1K',
    label: 'Baseline',
    resolvedEntryText: 'This is a baseline content entry for all users.',
    slug: 'baseline',
    selectedOptimizations: [],
    variantEntryId: '2Z2WLOx07InSewC3LUB3eX',
  }),
} as const

export type CustomerSegmentSlug = keyof typeof CUSTOMER_SEGMENTS
