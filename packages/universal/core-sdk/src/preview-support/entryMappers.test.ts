import type { ContentfulEntry, ContentfulEntryCollection } from './definitions'
import {
  createAudienceDefinitions,
  createExperienceDefinitions,
  createExperienceNameMap,
} from './entryMappers'

function audienceEntry(id: string, fields: ContentfulEntry['fields'] = {}): ContentfulEntry {
  return contentfulEntry(id, fields, 'nt_audience')
}

function experienceEntry(id: string, fields: ContentfulEntry['fields']): ContentfulEntry {
  return contentfulEntry(id, fields, 'nt_experience')
}

function contentfulEntry(
  id: string,
  fields: ContentfulEntry['fields'] = {},
  contentTypeId = 'content',
): ContentfulEntry {
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
          id: contentTypeId,
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
    fields,
  }
}

function unresolvedEntryLink(id: string): { sys: { type: 'Link'; linkType: 'Entry'; id: string } } {
  return {
    sys: {
      type: 'Link',
      linkType: 'Entry',
      id,
    },
  }
}

function contentfulCollection(
  items: ContentfulEntry[],
  includedEntries: ContentfulEntry[] = [],
): ContentfulEntryCollection {
  return {
    items,
    includes: includedEntries.length > 0 ? { Entry: includedEntries } : undefined,
    limit: 100,
    skip: 0,
    total: items.length,
  }
}

describe('createAudienceDefinitions', () => {
  test('maps nt_audience_id, nt_name, nt_description', () => {
    const [audience] = createAudienceDefinitions(
      contentfulCollection([
        audienceEntry('4ib0hsHWoSOnCVdDkizE8d', {
          nt_audience_id: '2WzXDaWtDmstHl9p8Wufpp',
          nt_name: 'Audience One',
          nt_description: 'a description',
        }),
      ]),
    )
    expect(audience).toEqual({
      id: '2WzXDaWtDmstHl9p8Wufpp',
      name: 'Audience One',
      description: 'a description',
    })
  })

  test('falls back to sys.id when nt_audience_id missing', () => {
    const [audience] = createAudienceDefinitions(
      contentfulCollection([audienceEntry('4ib0hsHWoSOnCVdDkizE8d', { nt_name: 'Only Name' })]),
    )
    expect(audience).toEqual({
      id: '4ib0hsHWoSOnCVdDkizE8d',
      name: 'Only Name',
      description: undefined,
    })
  })

  test('falls back to id for name when nt_name missing', () => {
    const [audience] = createAudienceDefinitions(
      contentfulCollection([
        audienceEntry('4ib0hsHWoSOnCVdDkizE8d', { nt_audience_id: '2WzXDaWtDmstHl9p8Wufpp' }),
      ]),
    )
    expect(audience?.name).toBe('2WzXDaWtDmstHl9p8Wufpp')
  })
})

describe('createExperienceDefinitions', () => {
  test('maps baseline and variants with percentages and names from linked entries', () => {
    const variantA = contentfulEntry('4ib0hsHWoSOnCVdDkizE8d', { internalTitle: 'Baseline' })
    const variantB = contentfulEntry('4k6ZyFQnR2POY5IJLLlJRb', { title: 'Variant One' })
    const variantC = contentfulEntry('2qVK4T5lnScbswoyBuGipd', { name: 'Variant Two' })

    const [exp] = createExperienceDefinitions(
      contentfulCollection(
        [
          experienceEntry('6IueRX1pS3iMJncbhUQTba', {
            nt_experience_id: '6IueRX1pS3iMJncbhUQTba',
            nt_name: 'Experience One',
            nt_type: 'nt_experiment',
            nt_config: {
              distribution: [0.5, 0.3, 0.2],
              components: [
                {
                  baseline: { id: '4ib0hsHWoSOnCVdDkizE8d' },
                  variants: [{ id: '4k6ZyFQnR2POY5IJLLlJRb' }, { id: '2qVK4T5lnScbswoyBuGipd' }],
                },
              ],
            },
            nt_audience: unresolvedEntryLink('2WzXDaWtDmstHl9p8Wufpp'),
          }),
        ],
        [variantA, variantB, variantC],
      ),
    )

    expect(exp).toEqual({
      id: '6IueRX1pS3iMJncbhUQTba',
      name: 'Experience One',
      type: 'nt_experiment',
      distribution: [
        { index: 0, variantRef: '4ib0hsHWoSOnCVdDkizE8d', percentage: 50, name: 'Baseline' },
        { index: 1, variantRef: '4k6ZyFQnR2POY5IJLLlJRb', percentage: 30, name: 'Variant One' },
        { index: 2, variantRef: '2qVK4T5lnScbswoyBuGipd', percentage: 20, name: 'Variant Two' },
      ],
      audience: { id: '2WzXDaWtDmstHl9p8Wufpp' },
    })
  })

  test('resolves variant name via internalTitle -> title -> name fallback chain', () => {
    const onlyTitle = contentfulEntry('4ib0hsHWoSOnCVdDkizE8d', { title: 'T' })
    const onlyName = contentfulEntry('4k6ZyFQnR2POY5IJLLlJRb', { name: 'N' })

    const [exp] = createExperienceDefinitions(
      contentfulCollection(
        [
          experienceEntry('6IueRX1pS3iMJncbhUQTba', {
            nt_experience_id: '6IueRX1pS3iMJncbhUQTba',
            nt_config: {
              distribution: [1, 0],
              components: [
                {
                  baseline: { id: '4ib0hsHWoSOnCVdDkizE8d' },
                  variants: [{ id: '4k6ZyFQnR2POY5IJLLlJRb' }],
                },
              ],
            },
          }),
        ],
        [onlyTitle, onlyName],
      ),
    )

    expect(exp?.distribution[0]?.name).toBe('T')
    expect(exp?.distribution[1]?.name).toBe('N')
  })

  test('returns empty distribution when nt_config is missing', () => {
    const [exp] = createExperienceDefinitions(
      contentfulCollection([
        experienceEntry('6IueRX1pS3iMJncbhUQTba', {
          nt_experience_id: '6IueRX1pS3iMJncbhUQTba',
          nt_name: 'No Config',
        }),
      ]),
    )
    expect(exp?.distribution).toEqual([])
  })

  test('returns empty distribution when distribution array is empty', () => {
    const [exp] = createExperienceDefinitions(
      contentfulCollection([
        experienceEntry('6IueRX1pS3iMJncbhUQTba', {
          nt_experience_id: '6IueRX1pS3iMJncbhUQTba',
          nt_config: { distribution: [], components: [] },
        }),
      ]),
    )
    expect(exp?.distribution).toEqual([])
  })

  test('omits audience when nt_audience is null', () => {
    const [exp] = createExperienceDefinitions(
      contentfulCollection([
        experienceEntry('6IueRX1pS3iMJncbhUQTba', {
          nt_experience_id: '6IueRX1pS3iMJncbhUQTba',
          nt_audience: null,
        }),
      ]),
    )
    expect(exp?.audience).toBeUndefined()
  })

  test('falls back to nt_personalization default type when nt_type missing', () => {
    const [exp] = createExperienceDefinitions(
      contentfulCollection([
        experienceEntry('6IueRX1pS3iMJncbhUQTba', { nt_experience_id: '6IueRX1pS3iMJncbhUQTba' }),
      ]),
    )
    expect(exp?.type).toBe('nt_personalization')
  })
})

describe('createExperienceNameMap', () => {
  test('maps nt_experience_id to nt_name', () => {
    const map = createExperienceNameMap(
      contentfulCollection([
        experienceEntry('4ib0hsHWoSOnCVdDkizE8d', {
          nt_experience_id: '6IueRX1pS3iMJncbhUQTba',
          nt_name: 'One',
        }),
        experienceEntry('4k6ZyFQnR2POY5IJLLlJRb', {
          nt_experience_id: '5jT8mNPxQ2rVuY4wZaB6Cd',
          nt_name: 'Two',
        }),
      ]),
    )
    expect(map).toEqual({ '6IueRX1pS3iMJncbhUQTba': 'One', '5jT8mNPxQ2rVuY4wZaB6Cd': 'Two' })
  })

  test('prefers nt_personalization_id over nt_experience_id when both present', () => {
    const map = createExperienceNameMap(
      contentfulCollection([
        experienceEntry('4ib0hsHWoSOnCVdDkizE8d', {
          nt_personalization_id: '6IueRX1pS3iMJncbhUQTba',
          nt_experience_id: '6IueRX1pS3iMJncbhUQTba',
          nt_name: 'Name',
        }),
      ]),
    )
    expect(map).toEqual({ '6IueRX1pS3iMJncbhUQTba': 'Name' })
  })

  test('skips entries without nt_name', () => {
    const map = createExperienceNameMap(
      contentfulCollection([
        experienceEntry('4ib0hsHWoSOnCVdDkizE8d', { nt_experience_id: '6IueRX1pS3iMJncbhUQTba' }),
      ]),
    )
    expect(map).toEqual({})
  })
})
