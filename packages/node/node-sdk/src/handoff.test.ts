import type {
  ManagedEntryHandoff,
  OptimizationCacheMetadata,
  OptimizationData,
  PrivateRequestOptimizationCacheMetadata,
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
    experienceId: '6IueRX1pS3iMJncbhUQTba',
    sticky: false,
    variantIndex: 1,
    variants: {
      '4ib0hsHWoSOnCVdDkizE8d': '4k6ZyFQnR2POY5IJLLlJRb',
    },
  },
]

const requestData: OptimizationData = {
  changes: [],
  profile: {
    id: 'f0837d7dc6344c36a3a0a06c4cde754b',
    stableId: 'f0837d7dc6344c36a3a0a06c4cde754b',
    random: 1,
    audiences: [],
    traits: {},
    location: {},
    session: {
      id: 'e77eab64-93ca-4f6e-8492-037c1ff67caa',
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
    const cache: PrivateRequestOptimizationCacheMetadata = {
      scope: 'private-request',
    }
    const entries: readonly ManagedEntryHandoff[] = [
      {
        baselineEntry: createTestEntry('4ib0hsHWoSOnCVdDkizE8d'),
        entryId: '4ib0hsHWoSOnCVdDkizE8d',
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
    'rejects $scope request handoff cache metadata',
    (cache) => {
      expect(() =>
        createRequestHandoffFromData({
          // @ts-expect-error -- testing runtime validation for invalid request cache scope.
          cache,
          data: requestData,
        }),
      ).toThrow(
        'Request handoffs must use private-request cache scope. Use public permutation handoffs for public cache scopes, or a non-request handoff for static output.',
      )
    },
  )

  it('rejects public request cache metadata without profile state', () => {
    expect(() =>
      createRequestHandoffFromData({
        // @ts-expect-error -- testing runtime validation for invalid request cache scope.
        cache: { key: 'customer-cache-key', scope: 'public-permutation' },
      }),
    ).toThrow(
      'Request handoffs must use private-request cache scope. Use public permutation handoffs for public cache scopes, or a non-request handoff for static output.',
    )
  })

  it('defaults to private request cache and omits state when data is absent', () => {
    const handoff = createRequestHandoffFromData({})

    expect(handoff).toEqual({ cache: { scope: 'private-request' } })
    expect(handoff.state).toBeUndefined()
  })
})
