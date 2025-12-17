import type { MergeTagEntry } from '@contentful/optimization-api-client'

export const mergeTagEntry: MergeTagEntry = {
  metadata: {
    tags: [],
    concepts: [],
  },
  sys: {
    space: {
      sys: {
        type: 'Link',
        linkType: 'Space',
        id: 'uelxcuo7v97l',
      },
    },
    id: 'nM127uVevlpDWytfZRyum',
    type: 'Entry',
    createdAt: '2025-10-15T15:08:43.051Z',
    updatedAt: '2025-10-15T15:08:52.541Z',
    environment: {
      sys: {
        id: 'master',
        type: 'Link',
        linkType: 'Environment',
      },
    },
    publishedVersion: 6,
    revision: 2,
    contentType: {
      sys: {
        type: 'Link',
        linkType: 'ContentType',
        id: 'nt_mergetag',
      },
    },
    locale: 'en-US',
  },
  fields: {
    nt_name: '[Merge Tag] Continent',
    nt_fallback: 'Nowhere',
    nt_mergetag_id: 'location.continent',
  },
}
