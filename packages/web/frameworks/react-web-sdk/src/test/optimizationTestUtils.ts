import type { Entry } from 'contentful'
import type { UseAnalyticsResult } from '../analytics/useAnalytics'
import type { UsePersonalizationResult } from '../personalization/usePersonalization'

export function createTestEntry(id: string): Entry {
  return {
    fields: { title: id },
    metadata: { tags: [] },
    sys: {
      contentType: { sys: { id: 'test-content-type', linkType: 'ContentType', type: 'Link' } },
      createdAt: '2024-01-01T00:00:00.000Z',
      environment: { sys: { id: 'main', linkType: 'Environment', type: 'Link' } },
      id,
      publishedVersion: 1,
      revision: 1,
      space: { sys: { id: 'space-id', linkType: 'Space', type: 'Link' } },
      type: 'Entry',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  }
}

export function createObservable<T>(current: T): {
  current: T
  subscribe: (next: (value: T) => void) => { unsubscribe: () => void }
  subscribeOnce: (next: (value: NonNullable<T>) => void) => { unsubscribe: () => void }
} {
  return {
    current,
    subscribe: () => ({ unsubscribe: () => undefined }),
    subscribeOnce: () => ({ unsubscribe: () => undefined }),
  }
}

export function requireAnalyticsResult(value: UseAnalyticsResult | undefined): UseAnalyticsResult {
  if (value === undefined) {
    throw new Error('Expected analytics hook result to be captured')
  }

  return value
}

export function requirePersonalizationResult(
  value: UsePersonalizationResult | undefined,
): UsePersonalizationResult {
  if (value === undefined) {
    throw new Error('Expected personalization hook result to be captured')
  }

  return value
}
