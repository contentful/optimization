import { safeCall, safeCallAsync } from './safeCall'

describe('safeCall', () => {
  it('forwards sync callback failures to onError', () => {
    const onError = rs.fn()

    safeCall(() => {
      throw new Error('sync-failure')
    }, onError)

    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('forwards async callback failures to onError', async () => {
    const onError = rs.fn()

    safeCall(async () => await Promise.reject(new Error('async-failure')), onError)

    await Promise.resolve()
    await Promise.resolve()

    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('isolates onError failures', async () => {
    const onError = rs.fn(() => {
      throw new Error('onError-failure')
    })

    expect(() => {
      safeCall(() => {
        throw new Error('sync-failure')
      }, onError)
    }).not.toThrow()

    safeCall(async () => await Promise.reject(new Error('async-failure')), onError)

    await Promise.resolve()
    await Promise.resolve()

    expect(onError).toHaveBeenCalledTimes(2)
  })

  it('swallows sync failures when onError is not provided', () => {
    expect(() => {
      safeCall(() => {
        throw new Error('sync-failure')
      })
    }).not.toThrow()
  })

  it('swallows async failures when onError is not provided', async () => {
    expect(() => {
      safeCall(async () => await Promise.reject(new Error('async-failure')))
    }).not.toThrow()

    await Promise.resolve()
    await Promise.resolve()
  })
})

describe('safeCallAsync', () => {
  it('awaits async callback completion', async () => {
    let completed = false

    await safeCallAsync(async () => {
      await Promise.resolve()
      completed = true
    })

    expect(completed).toBe(true)
  })

  it('forwards sync callback failures to onError', async () => {
    const onError = rs.fn()

    await safeCallAsync(() => {
      throw new Error('sync-failure')
    }, onError)

    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('forwards async callback failures to onError', async () => {
    const onError = rs.fn()

    await safeCallAsync(async () => await Promise.reject(new Error('async-failure')), onError)

    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('isolates onError failures', async () => {
    await expect(
      safeCallAsync(
        () => {
          throw new Error('sync-failure')
        },
        () => {
          throw new Error('onError-failure')
        },
      ),
    ).resolves.toBeUndefined()

    await expect(
      safeCallAsync(
        async () => await Promise.reject(new Error('async-failure')),
        async () => {
          await Promise.resolve()
          throw new Error('onError-failure')
        },
      ),
    ).resolves.toBeUndefined()
  })

  it('swallows sync failures when onError is not provided', async () => {
    await expect(
      safeCallAsync(() => {
        throw new Error('sync-failure')
      }),
    ).resolves.toBeUndefined()
  })

  it('swallows async failures when onError is not provided', async () => {
    await expect(
      safeCallAsync(async () => await Promise.reject(new Error('async-failure'))),
    ).resolves.toBeUndefined()
  })
})
