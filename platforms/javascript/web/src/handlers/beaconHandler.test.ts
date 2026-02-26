import { beaconHandler } from './beaconHandler'

describe('beaconHandler', () => {
  afterEach(() => {
    rs.restoreAllMocks()
  })

  it('serializes events into a text/plain Blob and forwards to sendBeacon', async () => {
    const sendBeacon = rs.spyOn(window.navigator, 'sendBeacon').mockReturnValue(true)
    const events: Parameters<typeof beaconHandler>[1] = []

    const ok = beaconHandler('/collect', events)

    expect(ok).toBe(true)
    expect(sendBeacon).toHaveBeenCalledTimes(1)

    const [url, body] = sendBeacon.mock.calls[0] ?? []
    expect(url).toBe('/collect')
    expect(body).toBeInstanceOf(Blob)
    if (!(body instanceof Blob)) {
      throw new Error('Expected sendBeacon body to be a Blob')
    }

    expect(body.type).toBe('text/plain')
    await expect(body.text()).resolves.toBe(JSON.stringify(events))
  })

  it('returns false when sendBeacon fails to queue the payload', () => {
    rs.spyOn(window.navigator, 'sendBeacon').mockReturnValue(false)
    const events: Parameters<typeof beaconHandler>[1] = []

    expect(beaconHandler('/collect', events)).toBe(false)
  })
})
