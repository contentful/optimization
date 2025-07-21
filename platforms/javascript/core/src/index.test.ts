import { Core } from './'

class TestCore extends Core {}

const options = { name: 'Test' }

describe('Core', () => {
  it('accepts name option', () => {
    const core = new TestCore(options)

    expect(core.name).toEqual(options.name)
  })
})
