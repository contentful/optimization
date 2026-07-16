import { describe, expect, it } from '@rstest/core'
import type { Entry, EntrySkeletonType } from 'contentful'
import type { SelectedOptimizationArray } from './api-schemas'
import type { ManagedEntryHandoff } from './CoreBase'
import {
  createHandoffFromSelections,
  createOptimizationCacheKey,
  createSelectionFingerprint,
  getOptimizationCacheSafetyWarnings,
  resolveEntriesForSelections,
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
      expect(
        getOptimizationCacheSafetyWarnings({
          cache: { scope: 'public-permutation' },
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
})
