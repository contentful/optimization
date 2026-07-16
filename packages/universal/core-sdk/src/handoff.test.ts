import { describe, expect, it } from '@rstest/core'
import type { Entry, EntrySkeletonType } from 'contentful'
import type { SelectedOptimizationArray } from './api-schemas'
import type { ManagedEntryHandoff } from './CoreBase'
import {
  assertOptimizationCacheSafety,
  createHandoffFromSelections,
  createOptimizationCacheKey,
  createPublicPermutationCacheMetadata,
  createSelectionFingerprint,
  getOptimizationCacheSafetyWarnings,
  resolveEntriesForSelections,
  type OptimizationCacheMetadata,
} from './handoff'
import { optimizedEntry } from './test/fixtures/optimizedEntry'
import { profile } from './test/fixtures/profile'

type TestEntry = Entry<EntrySkeletonType, undefined>

const EUROPE_EXPERIENCE_ID = '2qVK4T5lnScbswoyBuGipd'
const BASELINE_ENTRY_ID = '4ib0hsHWoSOnCVdDkizE8d'
const EUROPE_VARIANT_ENTRY_ID = '4k6ZyFQnR2POY5IJLLlJRb'

const createTestEntry = (id: string): TestEntry => ({
  fields: { title: id },
  metadata: { tags: [] },
  sys: {
    contentType: {
      sys: {
        id: 'testContentType',
        linkType: 'ContentType',
        type: 'Link',
      },
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    environment: {
      sys: {
        id: 'testEnvironment',
        linkType: 'Environment',
        type: 'Link',
      },
    },
    id,
    publishedVersion: 1,
    revision: 1,
    space: {
      sys: {
        id: 'testSpace',
        linkType: 'Space',
        type: 'Link',
      },
    },
    type: 'Entry',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
})

const canonicalSelections: SelectedOptimizationArray = [
  {
    experienceId: 'exp-b',
    sticky: false,
    variantIndex: 2,
    variants: {
      b: '2',
      a: '1',
    },
  },
  {
    experienceId: 'exp-a',
    variantIndex: 0,
    variants: {
      baseline: 'baseline',
    },
  },
]

const reorderedSelections: SelectedOptimizationArray = [
  {
    experienceId: 'exp-a',
    sticky: false,
    variantIndex: 0,
    variants: {
      baseline: 'baseline',
    },
  },
  {
    experienceId: 'exp-b',
    variantIndex: 2,
    variants: {
      a: '1',
      b: '2',
    },
  },
]

describe('handoff helpers', () => {
  describe('createSelectionFingerprint', () => {
    it('normalizes selection order, variants order, and omitted sticky values', () => {
      const fingerprint = createSelectionFingerprint(canonicalSelections)

      expect(fingerprint).toBe(createSelectionFingerprint(reorderedSelections))
      expect(fingerprint).toContain('ctfl-opt-selection:v1')
      expect(fingerprint).toContain('experience=exp-a')
      expect(fingerprint).toContain('variants=a=1,b=2')
    })

    it('sorts selections and variants by code-unit order', () => {
      const fingerprint = createSelectionFingerprint([
        {
          experienceId: 'a-exp',
          sticky: false,
          variantIndex: 1,
          variants: { é: 'accent', a: 'lower', Z: 'upper' },
        },
        {
          experienceId: 'Z-exp',
          sticky: false,
          variantIndex: 0,
          variants: {},
        },
      ])

      expect(fingerprint.indexOf('experience=Z-exp')).toBeLessThan(
        fingerprint.indexOf('experience=a-exp'),
      )
      expect(fingerprint).toContain('variants=Z=upper,a=lower,%C3%A9=accent')
    })

    it('distinguishes absent and empty selection state', () => {
      expect(createSelectionFingerprint(undefined)).toBe('ctfl-opt-selection:v1:none')
      expect(createSelectionFingerprint([])).toBe('ctfl-opt-selection:v1:empty')
    })
  })

  describe('createOptimizationCacheKey', () => {
    it('includes scope, locale, normalized entry IDs, and normalized selections', () => {
      const key = createOptimizationCacheKey({
        entryIds: ['entry-b', 'entry-a'],
        locale: 'en-US',
        scope: 'public-permutation',
        selectedOptimizations: canonicalSelections,
      })

      expect(key).toBe(
        createOptimizationCacheKey({
          entryIds: ['entry-a', 'entry-b'],
          locale: 'en-US',
          scope: 'public-permutation',
          selectedOptimizations: reorderedSelections,
        }),
      )
      expect(key).toContain('ctfl-opt-cache:v1')
      expect(key).toContain('scope=public-permutation')
      expect(key).toContain('locale=en-US')
      expect(key).toContain('entries=entry-a,entry-b')
      expect(key).toContain('selection=ctfl-opt-selection:v1')
    })

    it('sorts mixed-case and non-ASCII entry IDs by code-unit order', () => {
      const key = createOptimizationCacheKey({
        entryIds: ['é-entry', 'a-entry', 'Z-entry'],
        scope: 'static',
      })

      expect(key).toContain('entries=Z-entry,a-entry,%C3%A9-entry')
    })
  })

  describe('createPublicPermutationCacheMetadata', () => {
    it('builds an encoded public permutation key without generated tags', () => {
      const metadata = createPublicPermutationCacheMetadata({
        cacheVersion: 'version 1',
        entryIds: ['entry-b', 'entry-a'],
        locale: 'en-US',
        permutationKey: 'segment a/b',
        selectedOptimizations: canonicalSelections,
      })
      const expectedSelectionKey = createOptimizationCacheKey({
        entryIds: ['entry-a', 'entry-b'],
        locale: 'en-US',
        scope: 'public-permutation',
        selectedOptimizations: canonicalSelections,
      })

      expect(metadata).toEqual({
        key: `permutation=segment%20a%2Fb:version=version%201:${expectedSelectionKey}`,
        scope: 'public-permutation',
      })
    })

    it('omits cache version when absent and preserves custom tags', () => {
      const metadata = createPublicPermutationCacheMetadata({
        permutationKey: 'segment-a',
        selectedOptimizations: [],
        tags: ['segment-a', 'products'],
      })

      expect(metadata.key).toBe(
        `permutation=segment-a:${createOptimizationCacheKey({
          scope: 'public-permutation',
          selectedOptimizations: [],
        })}`,
      )
      expect(metadata.tags).toEqual(['segment-a', 'products'])
    })
  })

  describe('resolveEntriesForSelections', () => {
    it('preserves input order and includes each baseline entry', () => {
      const plainEntry = createTestEntry('plain-entry')
      const results = resolveEntriesForSelections({
        entries: [plainEntry, optimizedEntry],
        selectedOptimizations: [
          {
            experienceId: EUROPE_EXPERIENCE_ID,
            sticky: false,
            variantIndex: 1,
            variants: {
              [BASELINE_ENTRY_ID]: EUROPE_VARIANT_ENTRY_ID,
            },
          },
        ],
      })

      expect(results.map((result) => result.baselineEntry.sys.id)).toEqual([
        'plain-entry',
        BASELINE_ENTRY_ID,
      ])
      expect(results[0]?.entry).toBe(plainEntry)
      expect(results[1]?.entry.sys.id).toBe(EUROPE_VARIANT_ENTRY_ID)
    })

    it('uses variantIndex when variants metadata disagrees', () => {
      const results = resolveEntriesForSelections({
        entries: [optimizedEntry],
        selectedOptimizations: [
          {
            experienceId: EUROPE_EXPERIENCE_ID,
            sticky: false,
            variantIndex: 1,
            variants: {
              [BASELINE_ENTRY_ID]: BASELINE_ENTRY_ID,
            },
          },
        ],
      })

      expect(results[0]?.baselineEntry).toBe(optimizedEntry)
      expect(results[0]?.entry.sys.id).toBe(EUROPE_VARIANT_ENTRY_ID)
      expect(results[0]?.selectedOptimization?.variants[BASELINE_ENTRY_ID]).toBe(BASELINE_ENTRY_ID)
    })
  })

  describe('createHandoffFromSelections', () => {
    it('requires selectedOptimizations to be an array', () => {
      expect(() =>
        createHandoffFromSelections({
          cache: { scope: 'static' },
          // @ts-expect-error -- testing runtime validation for invalid caller input.
          selectedOptimizations: undefined,
        }),
      ).toThrow(TypeError)

      expect(() =>
        createHandoffFromSelections({
          cache: { scope: 'static' },
          // @ts-expect-error -- testing runtime validation for invalid caller input.
          selectedOptimizations: 'invalid',
        }),
      ).toThrow(TypeError)
    })

    it('serializes an explicit empty selection array and preserves entries', () => {
      const entries: readonly ManagedEntryHandoff[] = [
        {
          baselineEntry: optimizedEntry,
          entryId: BASELINE_ENTRY_ID,
        },
      ]
      const selectedOptimizations: SelectedOptimizationArray = []

      const handoff = createHandoffFromSelections({
        cache: { scope: 'static' },
        entries,
        selectedOptimizations,
      })

      expect(handoff.cache).toEqual({ scope: 'static' })
      expect(handoff.entries).toBe(entries)
      expect(handoff.state?.selectedOptimizations).toBe(selectedOptimizations)
      expect(handoff.state?.selectedOptimizations).toEqual([])
    })

    it('enforces cache safety', () => {
      // @ts-expect-error -- testing runtime validation for missing public cache key.
      const unsafePublicCache: OptimizationCacheMetadata = { scope: 'public-permutation' }

      expect(() =>
        createHandoffFromSelections({
          cache: unsafePublicCache,
          selectedOptimizations: [],
        }),
      ).toThrow('Public optimization permutations should include cache.key.')
    })
  })

  describe('getOptimizationCacheSafetyWarnings', () => {
    it('warns for profile state in public or static cache scopes', () => {
      expect(
        getOptimizationCacheSafetyWarnings({
          cache: { scope: 'static' },
          state: { profile },
        }),
      ).toEqual([
        {
          code: 'profile-state-in-public-cache',
          message: 'Profile state should not be included in public or static optimization caches.',
          path: ['state', 'profile'],
        },
      ])
    })

    it('warns for public permutations without a cache key', () => {
      // @ts-expect-error -- testing diagnostics for missing public cache key.
      const unsafePublicCache: OptimizationCacheMetadata = { scope: 'public-permutation' }

      expect(
        getOptimizationCacheSafetyWarnings({
          cache: unsafePublicCache,
          state: { selectedOptimizations: [] },
        }),
      ).toEqual([
        {
          code: 'missing-public-permutation-cache-key',
          message: 'Public optimization permutations should include cache.key.',
          path: ['cache', 'key'],
        },
      ])
    })
  })

  describe('assertOptimizationCacheSafety', () => {
    it('throws for cache safety warnings', () => {
      expect(() => {
        assertOptimizationCacheSafety({
          cache: { scope: 'static' },
          state: { profile },
        })
      }).toThrow('Profile state should not be included in public or static optimization caches.')
    })

    it('allows safe public permutations and static handoffs without profile state', () => {
      expect(() => {
        assertOptimizationCacheSafety({
          cache: { key: 'segment-a', scope: 'public-permutation' },
          state: { selectedOptimizations: [] },
        })
      }).not.toThrow()

      expect(() => {
        assertOptimizationCacheSafety({
          cache: { scope: 'static' },
          state: { selectedOptimizations: [] },
        })
      }).not.toThrow()
    })
  })
})
