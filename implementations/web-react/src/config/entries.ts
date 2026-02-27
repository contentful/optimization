export const AUTO_OBSERVED_ENTRY_IDS = [
  '1JAU028vQ7v6nB2swl3NBo',
  '1MwiFl4z7gkwqGYdvCmr8c',
  '4ib0hsHWoSOnCVdDkizE8d',
  'xFwgG3oNaOcjzWiGe4vXo',
  '2Z2WLOx07InSewC3LUB3eX',
] as const

export const MANUALLY_OBSERVED_ENTRY_IDS = [
  '5XHssysWUDECHzKLzoIsg1',
  '6zqoWXyiSrf0ja7I2WGtYj',
  '7pa5bOx8Z9NmNcr7mISvD',
] as const

export const ENTRY_IDS = [...AUTO_OBSERVED_ENTRY_IDS, ...MANUALLY_OBSERVED_ENTRY_IDS] as const

export const LIVE_UPDATES_ENTRY_ID = '2Z2WLOx07InSewC3LUB3eX' as const
export const PAGE_TWO_AUTO_ENTRY_ID = '2Z2WLOx07InSewC3LUB3eX' as const
export const PAGE_TWO_MANUAL_ENTRY_ID = '5XHssysWUDECHzKLzoIsg1' as const
