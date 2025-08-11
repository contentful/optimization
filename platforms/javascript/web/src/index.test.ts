import Optimization from './'

describe('Optimization', () => {
  it('gives itself a name', () => {
    const web = new Optimization()

    expect(web.name).toEqual(Optimization.name)
  })
})
