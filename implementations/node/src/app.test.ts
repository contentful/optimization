import request, { type Response } from 'supertest'
import app from './app'

const CLIENT_ID = process.env.VITE_NINETAILED_CLIENT_ID ?? 'error'

describe('GET /', () => {
  it('returns the client ID', async () => {
    const response: Response = await request(app).get('/')

    expect(response.text).toEqual(CLIENT_ID)
  })
})
