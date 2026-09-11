import { ResponseEnvelope } from './ResponseEnvelope'

describe('ResponseEnvelope', () => {
  it('parses a success envelope with a null error', () => {
    const result = ResponseEnvelope.safeParse({
      data: {},
      message: 'ok',
      error: null,
    })

    expect(result.success).toBe(true)
  })

  it('parses an error envelope with an error code object', () => {
    const result = ResponseEnvelope.safeParse({
      data: {},
      message: 'Config not found',
      error: { code: 'ERR_CONFIG_NOT_FOUND' },
    })

    expect(result.success).toBe(true)
  })

  it('rejects a boolean error value', () => {
    const result = ResponseEnvelope.safeParse({
      data: {},
      message: 'ok',
      error: false,
    })

    expect(result.success).toBe(false)
  })
})
