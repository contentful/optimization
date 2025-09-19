import Optimization from './'

describe('Optimization', () => {
  it('gives itself a name', () => {
    const node = new Optimization({ clientId: 'whatever' })

    expect(node.config.clientId).toEqual('whatever')
  })
})
