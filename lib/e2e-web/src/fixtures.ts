export type EntryClickScenario = 'direct' | 'descendant' | 'ancestor'

const clickScenarios = {
  '4ib0hsHWoSOnCVdDkizE8d': 'direct',
  xFwgG3oNaOcjzWiGe4vXo: 'descendant',
  '2Z2WLOx07InSewC3LUB3eX': 'ancestor',
} satisfies Record<string, EntryClickScenario>

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

export const FIXTURES = {
  clickScenarios,
  home: {
    ids: [...new Set([...homeAuto, ...homeManual])] as const,
    auto: homeAuto,
    manual: homeManual,
    liveUpdates: '2Z2WLOx07InSewC3LUB3eX' as const,
  },
  pageTwo: {
    ids: [pageTwoAuto, pageTwoManual] as const,
    auto: pageTwoAuto,
    manual: pageTwoManual,
  },
} as const
