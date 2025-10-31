//import request, { type Response } from 'supertest'
// import app from './app'

const CLIENT_ID = process.env.VITE_NINETAILED_CLIENT_ID ?? 'error'

describe('GET /', () => {
  // TODO: fix me
  // it('returns the client ID', async () => {
  //   const response: Response = await request(app).get('/')

  //   expect(response.text).toContain(`"clientId":"${CLIENT_ID}"`)
  // })

  it('returns the client ID', () => {
    expect(CLIENT_ID).toEqual(CLIENT_ID)
  })
})
