import { isRecord } from '@contentful/optimization-api-schemas'
import { afterAll, beforeAll, describe, expect, it } from '@rstest/core'
import { createClient } from 'contentful'
import { setupServer } from 'msw/node'
import { getHandlers } from './contentful-handlers'

const BASE_URL = 'https://cdn.example.test/'
const ENTRIES_URL = `${BASE_URL}spaces/space/environments/main/entries`
const ENTRY_A = '1FHhEY0xkcCC9R5WCmnjRr'
const ENTRY_B = '1JAU028vQ7v6nB2swl3NBo'
const server = setupServer(...getHandlers(BASE_URL))

async function readJsonRecord(response: Response): Promise<Record<string, unknown>> {
  const body: unknown = await response.json()
  if (!isRecord(body)) throw new Error('Expected a JSON object response.')
  return body
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterAll(() => {
  server.close()
})

describe('Contentful handlers', () => {
  it('applies exact field equality and limit to collection queries', async () => {
    const params = new URLSearchParams({
      content_type: 'content',
      'fields.internalTitle': '[Baseline] A',
      limit: '1',
    })
    const response = await fetch(`${ENTRIES_URL}?${params.toString()}`)
    const body = await readJsonRecord(response)

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ total: 1, limit: 1 })
    expect(body.items).toEqual([
      expect.objectContaining({ sys: expect.objectContaining({ id: '5XHssysWUDECHzKLzoIsg1' }) }),
    ])

    params.set('fields.internalTitle', '[Baseline]')
    const exactMatchBody = await readJsonRecord(await fetch(`${ENTRIES_URL}?${params.toString()}`))
    expect(exactMatchBody).toMatchObject({ total: 0, items: [] })
  })

  it('preserves cursor responses while applying limit', async () => {
    const params = new URLSearchParams({ content_type: 'content', cursor: 'true', limit: '1' })
    const body = await readJsonRecord(await fetch(`${ENTRIES_URL}?${params.toString()}`))

    expect(body).toMatchObject({ limit: 1, pages: {} })
    expect(body.items).toHaveLength(1)
  })

  it('serves requested entries with resolved links through the installed client', async () => {
    const client = createClient({
      accessToken: 'token',
      environment: 'main',
      host: 'cdn.example.test',
      space: 'space',
    })

    const entries = await client.getEntries({
      'sys.id[in]': [ENTRY_A, ENTRY_B, 'missing-entry'],
      locale: 'en-US',
      include: 10,
    })

    expect(entries.items.map(({ sys }) => sys.id)).toEqual(
      expect.arrayContaining([ENTRY_A, ENTRY_B]),
    )
    expect(entries.items).toHaveLength(2)
    expect(entries.items.find(({ sys }) => sys.id === ENTRY_A)).toMatchObject({
      fields: {
        nt_audience: {
          sys: { id: '4yIqY7AWtzeehCZxtQSDB' },
          fields: expect.any(Object),
        },
      },
    })
  })
})
