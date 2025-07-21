import NodeSDK from './'

describe('NodeSDK', () => {
  it('gives itself a name', () => {
    const node = new NodeSDK()

    expect(node.name).toEqual(NodeSDK.name)
  })
})
