import { fetchAllEntriesByContentType } from './contentfulFetch'
import type { ContentfulClient, ContentfulEntry, ContentfulEntryCollection } from './definitions'

function contentfulEntry(id: string): ContentfulEntry {
  return {
    metadata: {
      tags: [],
      concepts: [],
    },
    sys: {
      type: 'Entry',
      id,
      contentType: {
        sys: {
          type: 'Link',
          linkType: 'ContentType',
          id: 'nt_experience',
        },
      },
      publishedVersion: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      revision: 1,
      space: {
        sys: {
          type: 'Link',
          linkType: 'Space',
          id: 'space',
        },
      },
      environment: {
        sys: {
          type: 'Link',
          linkType: 'Environment',
          id: 'master',
        },
      },
    },
    fields: {},
  }
}

function contentfulCollection({
  includedEntries = [],
  items,
  skip,
  total,
}: {
  includedEntries?: ContentfulEntry[]
  items: ContentfulEntry[]
  skip: number
  total: number
}): ContentfulEntryCollection {
  return {
    items,
    includes: includedEntries.length > 0 ? { Entry: includedEntries } : undefined,
    limit: 100,
    skip,
    total,
  }
}

describe('fetchAllEntriesByContentType', () => {
  it('aggregates paginated items and collection-level included entries', async () => {
    const responses = [
      contentfulCollection({
        items: [contentfulEntry('experience-1')],
        includedEntries: [contentfulEntry('variant-1')],
        skip: 0,
        total: 2,
      }),
      contentfulCollection({
        items: [contentfulEntry('experience-2')],
        includedEntries: [contentfulEntry('variant-2')],
        skip: 100,
        total: 2,
      }),
    ]
    const queries: unknown[] = []
    const client: ContentfulClient = {
      async getEntries(query) {
        queries.push(query)
        const response = responses.shift()
        if (!response) throw new Error('Unexpected getEntries call')
        return await Promise.resolve(response)
      },
    }

    const result = await fetchAllEntriesByContentType(client, 'nt_experience')

    expect(result.items.map((entry) => entry.sys.id)).toEqual(['experience-1', 'experience-2'])
    expect(result.includes?.Entry?.map((entry) => entry.sys.id)).toEqual(['variant-1', 'variant-2'])
    expect(queries).toEqual([
      { content_type: 'nt_experience', include: 10, limit: 100, skip: 0 },
      { content_type: 'nt_experience', include: 10, limit: 100, skip: 100 },
    ])
  })
})
