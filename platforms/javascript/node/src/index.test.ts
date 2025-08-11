import Optimization from './'

describe('Optimization', () => {
  it('gives itself a name', () => {
    const node = new Optimization()

    expect(node.name).toEqual(Optimization.name)
  })
})
