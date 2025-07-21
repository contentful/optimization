import request, { type Response } from 'supertest'
import app from './app'

// TODO: this is more like an integration or E2E test; separate logic to modules and create actual unit tests
describe('GET /', () => {
  it('returns the name of the SDK', async () => {
    const response: Response = await request(app).get('/')

    expect(response.text).toEqual('NodeSDK')
  })
})
