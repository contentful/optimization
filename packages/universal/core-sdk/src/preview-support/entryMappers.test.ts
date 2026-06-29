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
        audienceEntry('sys-1', {
          nt_audience_id: 'aud-1',
          nt_name: 'Audience One',
          nt_description: 'a description',
        }),
      ]),
    )
    expect(audience).toEqual({ id: 'aud-1', name: 'Audience One', description: 'a description' })
  })

  test('falls back to sys.id when nt_audience_id missing', () => {
    const [audience] = createAudienceDefinitions(
      contentfulCollection([audienceEntry('sys-1', { nt_name: 'Only Name' })]),
    )
    expect(audience).toEqual({ id: 'sys-1', name: 'Only Name', description: undefined })
  })

  test('falls back to id for name when nt_name missing', () => {
    const [audience] = createAudienceDefinitions(
      contentfulCollection([audienceEntry('sys-1', { nt_audience_id: 'aud-1' })]),
    )
    expect(audience?.name).toBe('aud-1')
  })
})

describe('createExperienceDefinitions', () => {
  test('maps baseline and variants with percentages and names from linked entries', () => {
    const variantA = contentfulEntry('v-baseline', { internalTitle: 'Baseline' })
    const variantB = contentfulEntry('v-one', { title: 'Variant One' })
    const variantC = contentfulEntry('v-two', { name: 'Variant Two' })

    const [exp] = createExperienceDefinitions(
      contentfulCollection(
        [
          experienceEntry('sys-exp-1', {
            nt_experience_id: 'exp-1',
            nt_name: 'Experience One',
            nt_type: 'nt_experiment',
            nt_config: {
              distribution: [0.5, 0.3, 0.2],
              components: [
                {
                  baseline: { id: 'v-baseline' },
                  variants: [{ id: 'v-one' }, { id: 'v-two' }],
                },
              ],
            },
            nt_audience: unresolvedEntryLink('aud-1'),
          }),
        ],
        [variantA, variantB, variantC],
      ),
    )

    expect(exp).toEqual({
      id: 'exp-1',
      name: 'Experience One',
      type: 'nt_experiment',
      distribution: [
        { index: 0, variantRef: 'v-baseline', percentage: 50, name: 'Baseline' },
        { index: 1, variantRef: 'v-one', percentage: 30, name: 'Variant One' },
        { index: 2, variantRef: 'v-two', percentage: 20, name: 'Variant Two' },
      ],
      audience: { id: 'aud-1' },
    })
  })

  test('resolves variant name via internalTitle -> title -> name fallback chain', () => {
    const onlyTitle = contentfulEntry('v-a', { title: 'T' })
    const onlyName = contentfulEntry('v-b', { name: 'N' })

    const [exp] = createExperienceDefinitions(
      contentfulCollection(
        [
          experienceEntry('sys-exp-1', {
            nt_experience_id: 'exp-1',
            nt_config: {
              distribution: [1, 0],
              components: [{ baseline: { id: 'v-a' }, variants: [{ id: 'v-b' }] }],
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
        experienceEntry('sys-exp-1', { nt_experience_id: 'exp-1', nt_name: 'No Config' }),
      ]),
    )
    expect(exp?.distribution).toEqual([])
  })

  test('returns empty distribution when distribution array is empty', () => {
    const [exp] = createExperienceDefinitions(
      contentfulCollection([
        experienceEntry('sys-exp-1', {
          nt_experience_id: 'exp-1',
          nt_config: { distribution: [], components: [] },
        }),
      ]),
    )
    expect(exp?.distribution).toEqual([])
  })

  test('omits audience when nt_audience is null', () => {
    const [exp] = createExperienceDefinitions(
      contentfulCollection([
        experienceEntry('sys-exp-1', {
          nt_experience_id: 'exp-1',
          nt_audience: null,
        }),
      ]),
    )
    expect(exp?.audience).toBeUndefined()
  })

  test('falls back to nt_personalization default type when nt_type missing', () => {
    const [exp] = createExperienceDefinitions(
      contentfulCollection([experienceEntry('sys-exp-1', { nt_experience_id: 'exp-1' })]),
    )
    expect(exp?.type).toBe('nt_personalization')
  })
})

describe('createExperienceNameMap', () => {
  test('maps nt_experience_id to nt_name', () => {
    const map = createExperienceNameMap(
      contentfulCollection([
        experienceEntry('sys-1', { nt_experience_id: 'exp-1', nt_name: 'One' }),
        experienceEntry('sys-2', { nt_experience_id: 'exp-2', nt_name: 'Two' }),
      ]),
    )
    expect(map).toEqual({ 'exp-1': 'One', 'exp-2': 'Two' })
  })

  test('prefers nt_personalization_id over nt_experience_id when both present', () => {
    const map = createExperienceNameMap(
      contentfulCollection([
        experienceEntry('sys-1', {
          nt_personalization_id: 'per-1',
          nt_experience_id: 'exp-1',
          nt_name: 'Name',
        }),
      ]),
    )
    expect(map).toEqual({ 'per-1': 'Name' })
  })

  test('skips entries without nt_name', () => {
    const map = createExperienceNameMap(
      contentfulCollection([experienceEntry('sys-1', { nt_experience_id: 'exp-1' })]),
    )
    expect(map).toEqual({})
  })
})
