import { beaconHandler } from './beaconHandler'

describe('beaconHandler', () => {
  afterEach(() => {
    rs.restoreAllMocks()
  })

  it('forwards a serialized body to sendBeacon', () => {
    const sendBeacon = rs.spyOn(window.navigator, 'sendBeacon').mockReturnValue(true)
    const bodyText = '[]'

    const ok = beaconHandler('/collect', bodyText)

    expect(ok).toBe(true)
    expect(sendBeacon).toHaveBeenCalledTimes(1)
    expect(sendBeacon).toHaveBeenCalledWith('/collect', bodyText)
  })

  it('returns false when sendBeacon fails to queue the payload', () => {
    rs.spyOn(window.navigator, 'sendBeacon').mockReturnValue(false)
    expect(beaconHandler('/collect', '[]')).toBe(false)
  })
})
