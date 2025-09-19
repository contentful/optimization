import request, { type Response } from 'supertest'
import app from './app'

describe('GET /', () => {
  it('returns the client ID', async () => {
    const response: Response = await request(app).get('/')

    expect(response.text).toEqual('whatever')
  })
})
