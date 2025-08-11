import CoreBase from './'

class TestCore extends CoreBase {}

const config = { name: 'Test' }

describe('CoreBase', () => {
  it('accepts name option', () => {
    const core = new TestCore(config)

    expect(core.name).toEqual(config.name)
  })
})
