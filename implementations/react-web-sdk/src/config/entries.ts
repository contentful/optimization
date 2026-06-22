import { pages } from 'e2e-web/src/fixtures'

const {
  home: {
    auto: AUTO_OBSERVED_ENTRY_IDS,
    manual: MANUALLY_OBSERVED_ENTRY_IDS,
    ids: ENTRY_IDS,
    liveUpdates: LIVE_UPDATES_ENTRY_ID,
  },
  pageTwo: { auto: PAGE_TWO_AUTO_ENTRY_ID, manual: PAGE_TWO_MANUAL_ENTRY_ID },
} = pages

export {
  AUTO_OBSERVED_ENTRY_IDS,
  ENTRY_IDS,
  LIVE_UPDATES_ENTRY_ID,
  MANUALLY_OBSERVED_ENTRY_IDS,
  PAGE_TWO_AUTO_ENTRY_ID,
  PAGE_TWO_MANUAL_ENTRY_ID,
}
