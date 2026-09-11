import request, { type Response } from 'supertest'
import app from './app'

const SPACE_ID = process.env.PUBLIC_CONTENTFUL_SPACE_ID ?? ''

describe('GET /', () => {
  it('returns the space ID', async () => {
    const response: Response = await request(app).get('/smoke-test')

    expect(response.text).toContain(`"spaceId":"${SPACE_ID}"`)
  })
})
