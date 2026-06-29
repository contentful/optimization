import {
  CtflEntry,
  normalizeOptimizationConfig,
  OptimizationEntry,
  OptimizedEntry,
  type OptimizationConfig,
} from '.'

const optimizationEntryBase = {
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

const entryBase = {
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
        id: 'article',
      },
    },
    publishedVersion: 1,
    id: 'entry-id',
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
  fields: {},
}

describe('normalizeOptimizationConfig', () => {
  it('returns runtime-safe defaults for nullish configs', () => {
    expect(normalizeOptimizationConfig(undefined)).toEqual({
      distribution: [],
      traffic: 0,
      components: [],
      sticky: false,
    })

    expect(normalizeOptimizationConfig(null)).toEqual({
      distribution: [],
      traffic: 0,
      components: [],
      sticky: false,
    })
  })

  it('preserves explicit values and fills only omitted fields', () => {
    const config: OptimizationConfig = {
      distribution: [0.25, 0.75],
      components: [],
    }

    expect(normalizeOptimizationConfig(config)).toEqual({
      distribution: [0.25, 0.75],
      traffic: 0,
      components: [],
      sticky: false,
    })
  })
})

describe('CtflEntry', () => {
  it('passes through arbitrary consumer fields without recursively validating them', () => {
    const parent = {
      ...entryBase,
      fields: {},
    }
    const child = {
      ...entryBase,
      sys: {
        ...entryBase.sys,
        id: 'child-entry-id',
      },
      fields: {
        richText: {
          nodeType: 'document',
          data: {},
          content: [
            {
              nodeType: 'embedded-entry-block',
              data: { target: parent },
              content: [],
            },
          ],
        },
      },
    }
    parent.fields = {
      relatedEntry: child,
    }

    expect(CtflEntry.safeParse(parent).success).toBe(true)
  })

  it('still validates Contentful system metadata', () => {
    expect(
      CtflEntry.safeParse({
        ...entryBase,
        sys: {
          ...entryBase.sys,
          id: 123,
        },
      }).success,
    ).toBe(false)
  })
})

describe('OptimizationEntry', () => {
  it('does not fabricate nt_config during parsing', () => {
    const result = OptimizationEntry.safeParse(optimizationEntryBase)

    expect(result.success).toBe(true)

    if (!result.success) throw new Error('Expected OptimizationEntry to parse')

    expect(result.data.fields.nt_config).toBeUndefined()
  })

  it('still validates optimization-owned config fields', () => {
    expect(
      OptimizationEntry.safeParse({
        ...optimizationEntryBase,
        fields: {
          ...optimizationEntryBase.fields,
          nt_config: {
            components: [
              {
                type: 'EntryReplacement',
                baseline: { id: 123 },
                variants: [],
              },
            ],
          },
        },
      }).success,
    ).toBe(false)
  })
})

describe('OptimizedEntry', () => {
  it('still requires valid optimization references', () => {
    expect(
      OptimizedEntry.safeParse({
        ...entryBase,
        fields: {
          nt_experiences: [
            {
              sys: {
                id: 'missing-link-shape',
              },
            },
          ],
        },
      }).success,
    ).toBe(false)
  })
})
