import type {
  ManagedEntryHandoff,
  OptimizationCacheMetadata,
  OptimizationData,
} from '@contentful/optimization-core'
import type { Entry, EntrySkeletonType } from 'contentful'
import { createRequestHandoffFromData } from './handoff'

type TestEntry = Entry<EntrySkeletonType, undefined>

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

const selectedOptimizations: OptimizationData['selectedOptimizations'] = [
  {
    experienceId: 'experience-id',
    sticky: false,
    variantIndex: 1,
    variants: {
      baseline: 'variant',
    },
  },
]

const requestData: OptimizationData = {
  changes: [],
  profile: {
    id: 'response-profile-id',
    stableId: 'response-profile-id',
    random: 1,
    audiences: [],
    traits: {},
    location: {},
    session: {
      id: 'session-id',
      isReturningVisitor: false,
      landingPage: {
        path: '/',
        query: {},
        referrer: '',
        search: '',
        title: '',
        url: 'https://example.test/',
      },
      count: 1,
      activeSessionLength: 0,
      averageSessionLength: 0,
    },
  },
  selectedOptimizations,
}

describe('createRequestHandoffFromData', () => {
  it('maps completed request OptimizationData into Core handoff state', () => {
    const cache: OptimizationCacheMetadata = {
      scope: 'private-request',
    }
    const entries: readonly ManagedEntryHandoff[] = [
      {
        baselineEntry: createTestEntry('entry-id'),
        entryId: 'entry-id',
      },
    ]
    const handoff = createRequestHandoffFromData({
      cache,
      data: requestData,
      entries,
    })

    expect(handoff.cache).toBe(cache)
    expect(handoff.entries).toBe(entries)
    expect(handoff.state).toEqual({
      selectedOptimizations: requestData.selectedOptimizations,
      changes: requestData.changes,
      profile: requestData.profile,
    })
    expect(handoff.state?.selectedOptimizations).toBe(requestData.selectedOptimizations)
    expect(handoff.state?.changes).toBe(requestData.changes)
    expect(handoff.state?.profile).toBe(requestData.profile)
  })

  it.each([
    { key: 'customer-cache-key', scope: 'public-permutation' },
    { scope: 'static' },
  ] satisfies readonly OptimizationCacheMetadata[])(
    'rejects $scope request data with profile state',
    (cache) => {
      expect(() =>
        createRequestHandoffFromData({
          cache,
          data: requestData,
        }),
      ).toThrow(
        'Profile state should not be included in public or static optimization caches. Request handoffs with profile state must use private-request cache scope.',
      )
    },
  )

  it('allows public cache metadata warnings unrelated to profile state', () => {
    const handoff = createRequestHandoffFromData({
      cache: { scope: 'public-permutation' },
    })

    expect(handoff).toEqual({ cache: { scope: 'public-permutation' } })
  })

  it('defaults to private request cache and omits state when data is absent', () => {
    const handoff = createRequestHandoffFromData({})

    expect(handoff).toEqual({ cache: { scope: 'private-request' } })
    expect(handoff.state).toBeUndefined()
  })
})
