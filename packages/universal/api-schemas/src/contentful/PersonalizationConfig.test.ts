import { normalizePersonalizationConfig, PersonalizationEntry, type PersonalizationConfig } from '.'

const personalizationEntryBase = {
  metadata: {
    tags: [],
    concepts: [],
  },
  sys: {
    type: 'Entry',
    contentType: {
      sys: {
        type: 'Link',
        linkType: 'ContentType',
        id: 'nt_experience',
      },
    },
    publishedVersion: 1,
    id: 'experience-id',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    revision: 1,
    space: {
      sys: {
        type: 'Link',
        linkType: 'Space',
        id: 'space-id',
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
  fields: {
    nt_name: 'Example personalization',
    nt_description: null,
    nt_type: 'nt_personalization' as const,
    nt_audience: null,
    nt_experience_id: 'experience-id',
  },
}

describe('normalizePersonalizationConfig', () => {
  it('returns runtime-safe defaults for nullish configs', () => {
    expect(normalizePersonalizationConfig(undefined)).toEqual({
      distribution: [],
      traffic: 0,
      components: [],
      sticky: false,
    })

    expect(normalizePersonalizationConfig(null)).toEqual({
      distribution: [],
      traffic: 0,
      components: [],
      sticky: false,
    })
  })

  it('preserves explicit values and fills only omitted fields', () => {
    const config: PersonalizationConfig = {
      distribution: [0.25, 0.75],
      components: [],
    }

    expect(normalizePersonalizationConfig(config)).toEqual({
      distribution: [0.25, 0.75],
      traffic: 0,
      components: [],
      sticky: false,
    })
  })
})

describe('PersonalizationEntry', () => {
  it('does not fabricate nt_config during parsing', () => {
    const result = PersonalizationEntry.safeParse(personalizationEntryBase)

    expect(result.success).toBe(true)

    if (!result.success) throw new Error('Expected PersonalizationEntry to parse')

    expect(result.data.fields.nt_config).toBeUndefined()
  })
})
