import {
  isMergeTagEntry,
  isRecord,
  isResolvedContentfulEntry,
  isResolvedOptimizationEntry,
  isResolvedOptimizedEntry,
  isRichTextDocument,
  isRichTextNode,
  isUnresolvedEntryLink,
  normalizeOptimizationConfig,
  OptimizationEntryFields,
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

const mergeTagEntryBase = {
  ...entryBase,
  sys: {
    ...entryBase.sys,
    contentType: {
      sys: {
        type: 'Link',
        linkType: 'ContentType',
        id: 'nt_mergetag',
      },
    },
    id: 'merge-tag-entry-id',
  },
  fields: {
    nt_name: 'Location',
    nt_fallback: 'Nowhere',
    nt_mergetag_id: 'traits_location',
  },
}

const unresolvedEntryLink = {
  sys: {
    type: 'Link',
    linkType: 'Entry',
    id: 'entry-link-id',
  },
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

describe('Contentful entry guards', () => {
  it('treats records as non-null non-array objects only', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord(Object.create(null))).toBe(true)
    expect(isRecord([])).toBe(false)
    expect(isRecord(null)).toBe(false)
    expect(isRecord('value')).toBe(false)
    expect(isRecord(1)).toBe(false)
    expect(isRecord(true)).toBe(false)
    expect(isRecord(undefined)).toBe(false)
  })

  it('recognizes resolved entries without recursively validating consumer fields', () => {
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

    expect(isResolvedContentfulEntry(parent)).toBe(true)
  })

  it('rejects unresolved links as resolved entries', () => {
    expect(
      isResolvedContentfulEntry({
        sys: {
          type: 'Link',
          linkType: 'Entry',
          id: 'entry-id',
        },
      }),
    ).toBe(false)
  })

  it('continues recognizing unresolved entry links', () => {
    expect(isUnresolvedEntryLink(unresolvedEntryLink)).toBe(true)
    expect(
      isUnresolvedEntryLink({ sys: { type: 'Link', linkType: 'Asset', id: 'asset-id' } }),
    ).toBe(false)
    expect(isUnresolvedEntryLink({ sys: { type: 'Entry', id: 'entry-id' } })).toBe(false)
  })

  it('continues recognizing merge-tag entries', () => {
    expect(isMergeTagEntry(mergeTagEntryBase)).toBe(true)
    expect(
      isMergeTagEntry({
        ...mergeTagEntryBase,
        fields: {
          nt_name: 'Location',
          nt_fallback: 'Nowhere',
        },
      }),
    ).toBe(false)
    expect(isMergeTagEntry(entryBase)).toBe(false)
  })
})

describe('Rich Text guards', () => {
  it('recognizes Rich Text documents and nodes', () => {
    const textNode = {
      nodeType: 'text',
      value: 'Hello',
      marks: [],
      data: {},
    }
    const paragraphNode = {
      nodeType: 'paragraph',
      data: {},
      content: [textNode],
    }
    const document = {
      nodeType: 'document',
      data: {},
      content: [paragraphNode],
    }

    expect(isRichTextNode(textNode)).toBe(true)
    expect(isRichTextNode(paragraphNode)).toBe(true)
    expect(isRichTextNode(document)).toBe(true)
    expect(isRichTextDocument(document)).toBe(true)
  })

  it('rejects non-Rich Text and malformed Rich Text values', () => {
    expect(isRichTextNode(null)).toBe(false)
    expect(isRichTextNode([])).toBe(false)
    expect(isRichTextNode({ nodeType: 'paragraph', data: {}, content: {} })).toBe(false)
    expect(isRichTextNode({ nodeType: 'paragraph', content: [] })).toBe(false)
    expect(isRichTextNode({ data: {}, content: [] })).toBe(false)
    expect(isRichTextDocument({ nodeType: 'paragraph', data: {}, content: [] })).toBe(false)
    expect(isRichTextDocument({ nodeType: 'document', data: {}, content: {} })).toBe(false)
    expect(isRichTextDocument({ nodeType: 'document', data: {} })).toBe(false)
  })
})

describe('OptimizationEntry', () => {
  it('does not fabricate nt_config during parsing', () => {
    const result = OptimizationEntryFields.safeParse(optimizationEntryBase.fields)

    expect(result.success).toBe(true)

    if (!result.success) throw new Error('Expected OptimizationEntryFields to parse')

    expect(result.data.nt_config).toBeUndefined()
  })

  it('still validates optimization-owned config fields', () => {
    expect(
      OptimizationEntryFields.safeParse({
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
      }).success,
    ).toBe(false)
  })

  it('recognizes resolved optimization entries with valid Contentful references', () => {
    expect(isResolvedOptimizationEntry(optimizationEntryBase)).toBe(true)
  })
})

describe('OptimizedEntry', () => {
  it('still requires valid optimization references', () => {
    expect(
      isResolvedOptimizedEntry({
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
      }),
    ).toBe(false)
  })
})
