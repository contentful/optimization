import WebSDK from './'

describe('WebSDK', () => {
  it('gives itself a name', () => {
    const web = new WebSDK()

    expect(web.name).toEqual(WebSDK.name)
  })
})
