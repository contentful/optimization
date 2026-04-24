import type { ContentfulEntry } from './definitions'
import {
  createAudienceDefinitions,
  createExperienceDefinitions,
  createExperienceNameMap,
} from './entryMappers'

function audienceEntry(id: string, fields: Record<string, unknown> = {}): ContentfulEntry {
  return { sys: { id }, fields }
}

function experienceEntry(
  id: string,
  fields: Record<string, unknown>,
  includes?: ContentfulEntry[],
): ContentfulEntry {
  const entry: ContentfulEntry & { includes?: { Entry?: ContentfulEntry[] } } = {
    sys: { id },
    fields,
  }
  if (includes) entry.includes = { Entry: includes }
  return entry
}

describe('createAudienceDefinitions', () => {
  test('maps nt_audience_id, nt_name, nt_description', () => {
    const [audience] = createAudienceDefinitions([
      audienceEntry('sys-1', {
        nt_audience_id: 'aud-1',
        nt_name: 'Audience One',
        nt_description: 'a description',
      }),
    ])
    expect(audience).toEqual({ id: 'aud-1', name: 'Audience One', description: 'a description' })
  })

  test('falls back to sys.id when nt_audience_id missing', () => {
    const [audience] = createAudienceDefinitions([audienceEntry('sys-1', { nt_name: 'Only Name' })])
    expect(audience).toEqual({ id: 'sys-1', name: 'Only Name', description: undefined })
  })

  test('falls back to id for name when nt_name missing', () => {
    const [audience] = createAudienceDefinitions([
      audienceEntry('sys-1', { nt_audience_id: 'aud-1' }),
    ])
    expect(audience?.name).toBe('aud-1')
  })
})

describe('createExperienceDefinitions', () => {
  test('maps baseline and variants with percentages and names from linked entries', () => {
    const variantA: ContentfulEntry = {
      sys: { id: 'v-baseline' },
      fields: { internalTitle: 'Baseline' },
    }
    const variantB: ContentfulEntry = { sys: { id: 'v-one' }, fields: { title: 'Variant One' } }
    const variantC: ContentfulEntry = { sys: { id: 'v-two' }, fields: { name: 'Variant Two' } }

    const [exp] = createExperienceDefinitions([
      experienceEntry(
        'sys-exp-1',
        {
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
          nt_audience: { sys: { id: 'aud-1' } },
        },
        [variantA, variantB, variantC],
      ),
    ])

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
    const onlyTitle: ContentfulEntry = { sys: { id: 'v-a' }, fields: { title: 'T' } }
    const onlyName: ContentfulEntry = { sys: { id: 'v-b' }, fields: { name: 'N' } }

    const [exp] = createExperienceDefinitions([
      experienceEntry(
        'sys-exp-1',
        {
          nt_experience_id: 'exp-1',
          nt_config: {
            distribution: [1, 0],
            components: [{ baseline: { id: 'v-a' }, variants: [{ id: 'v-b' }] }],
          },
        },
        [onlyTitle, onlyName],
      ),
    ])

    expect(exp?.distribution[0]?.name).toBe('T')
    expect(exp?.distribution[1]?.name).toBe('N')
  })

  test('returns empty distribution when nt_config is missing', () => {
    const [exp] = createExperienceDefinitions([
      experienceEntry('sys-exp-1', { nt_experience_id: 'exp-1', nt_name: 'No Config' }),
    ])
    expect(exp?.distribution).toEqual([])
  })

  test('returns empty distribution when distribution array is empty', () => {
    const [exp] = createExperienceDefinitions([
      experienceEntry('sys-exp-1', {
        nt_experience_id: 'exp-1',
        nt_config: { distribution: [], components: [] },
      }),
    ])
    expect(exp?.distribution).toEqual([])
  })

  test('omits audience when nt_audience is null', () => {
    const [exp] = createExperienceDefinitions([
      experienceEntry('sys-exp-1', {
        nt_experience_id: 'exp-1',
        nt_audience: null,
      }),
    ])
    expect(exp?.audience).toBeUndefined()
  })

  test('falls back to nt_personalization default type when nt_type missing', () => {
    const [exp] = createExperienceDefinitions([
      experienceEntry('sys-exp-1', { nt_experience_id: 'exp-1' }),
    ])
    expect(exp?.type).toBe('nt_personalization')
  })
})

describe('createExperienceNameMap', () => {
  test('maps nt_experience_id to nt_name', () => {
    const map = createExperienceNameMap([
      experienceEntry('sys-1', { nt_experience_id: 'exp-1', nt_name: 'One' }),
      experienceEntry('sys-2', { nt_experience_id: 'exp-2', nt_name: 'Two' }),
    ])
    expect(map).toEqual({ 'exp-1': 'One', 'exp-2': 'Two' })
  })

  test('prefers nt_personalization_id over nt_experience_id when both present', () => {
    const map = createExperienceNameMap([
      experienceEntry('sys-1', {
        nt_personalization_id: 'per-1',
        nt_experience_id: 'exp-1',
        nt_name: 'Name',
      }),
    ])
    expect(map).toEqual({ 'per-1': 'Name' })
  })

  test('skips entries without nt_name', () => {
    const map = createExperienceNameMap([experienceEntry('sys-1', { nt_experience_id: 'exp-1' })])
    expect(map).toEqual({})
  })
})
