import type { AudienceEntry } from '@contentful/optimization-web'

/**
 * Identifier for the synthetic "All Visitors" audience used as a fallback.
 *
 * @public
 */
export const ALL_VISITORS_FALLBACK_AUDIENCE_ID = 'ALL_VISITORS'

/**
 * Display name for the synthetic "All Visitors" audience.
 *
 * @public
 */
export const ALL_VISITORS_FALLBACK_AUDIENCE_NAME = 'All Visitors (automatically generated)'

/**
 * Synthetic {@link AudienceEntry} representing the "All Visitors" audience,
 * used to group personalizations that do not target a specific audience.
 *
 * @public
 */
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
