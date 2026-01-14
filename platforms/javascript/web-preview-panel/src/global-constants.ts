import type { AudienceEntry } from '@contentful/optimization-web'

export const ALL_VISITORS_FALLBACK_AUDIENCE_ID = 'ALL_VISITORS'
export const ALL_VISITORS_FALLBACK_AUDIENCE_NAME = 'All Visitors (automatically generated)'

export const ALL_VISITORS_FALLBACK_AUDIENCE: AudienceEntry = {
  metadata: { tags: [] },
  sys: {
    type: 'Entry',
    id: ALL_VISITORS_FALLBACK_AUDIENCE_ID,
    contentType: {
      sys: {
        type: 'Link',
        linkType: 'ContentType',
        id: 'nt_audience',
      },
    },
    publishedVersion: 1,
    createdAt: undefined,
    updatedAt: undefined,
    revision: 1,
    space: { sys: { type: 'Link', linkType: 'Space', id: '' } },
    environment: { sys: { type: 'Link', linkType: 'Environment', id: '' } },
  },
  fields: {
    nt_audience_id: ALL_VISITORS_FALLBACK_AUDIENCE_ID,
    nt_name: ALL_VISITORS_FALLBACK_AUDIENCE_NAME,
  },
}
