import request, { type Response } from 'supertest'
import app from './app'

const OPTIMIZATION_KEY = process.env.VITE_NINETAILED_CLIENT_ID ?? 'error'

describe('GET /', () => {
  it('returns the client ID', async () => {
    const response: Response = await request(app).get('/')

    expect(response.text).toEqual(OPTIMIZATION_KEY)
  })
})
