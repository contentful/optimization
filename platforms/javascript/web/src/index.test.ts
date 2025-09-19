import Optimization from './'

describe('Optimization', () => {
  it('sets configured options', () => {
    const web = new Optimization({ clientId: 'whatever' })

    expect(web.config.clientId).toEqual('whatever')
  })
})
