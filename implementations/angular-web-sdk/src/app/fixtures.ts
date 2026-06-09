export type EntryClickScenario = 'direct' | 'descendant' | 'ancestor'

const clickScenarios: Record<string, EntryClickScenario> = {
  '4ib0hsHWoSOnCVdDkizE8d': 'direct',
  xFwgG3oNaOcjzWiGe4vXo: 'descendant',
  '2Z2WLOx07InSewC3LUB3eX': 'ancestor',
}

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

export const FIXTURES = {
  home: {
    ids: [...new Set([...homeAuto, ...homeManual])] as const,
    auto: homeAuto,
    manual: homeManual,
    liveUpdates: '2Z2WLOx07InSewC3LUB3eX' as const,
    clickScenarios,
  },
  pageTwo: {
    auto: '2Z2WLOx07InSewC3LUB3eX' as const,
    manual: '5XHssysWUDECHzKLzoIsg1' as const,
  },
} as const
