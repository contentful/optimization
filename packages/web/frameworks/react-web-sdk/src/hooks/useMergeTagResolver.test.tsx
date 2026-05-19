import type { MergeTagEntry } from '@contentful/optimization-web/api-schemas'
import { renderToString } from 'react-dom/server'
import {
  OptimizationContext,
  useMergeTagResolver,
  type OptimizationSdk,
  type UseMergeTagResolverResult,
} from '../index'
import { createOptimizationSdk } from '../test/sdkTestUtils'

const mergeTagEntry: MergeTagEntry = {
  fields: {
    nt_name: '[Merge Tag] Continent',
    nt_fallback: 'Nowhere',
    nt_mergetag_id: 'location.continent',
  },
  metadata: {
    concepts: [],
    tags: [],
  },
  sys: {
    contentType: {
      sys: {
        id: 'nt_mergetag',
        linkType: 'ContentType',
        type: 'Link',
      },
    },
    createdAt: '2025-10-15T15:08:43.051Z',
    environment: {
      sys: {
        id: 'master',
        linkType: 'Environment',
        type: 'Link',
      },
    },
    id: 'merge-tag-entry',
    locale: 'en-US',
    publishedVersion: 6,
    revision: 2,
    space: {
      sys: {
        id: 'space-id',
        linkType: 'Space',
        type: 'Link',
      },
    },
    type: 'Entry',
    updatedAt: '2025-10-15T15:08:52.541Z',
  },
}

function requireMergeTagResolver(
  value: UseMergeTagResolverResult | undefined,
): UseMergeTagResolverResult {
  if (value === undefined) {
    throw new Error('Expected merge tag resolver to be captured')
  }

  return value
}

describe('useMergeTagResolver', () => {
  it('wraps getMergeTagValue to preserve SDK method context', () => {
    const getMergeTagValueCalls: unknown[] = []
    let capturedResolver: UseMergeTagResolverResult | undefined = undefined
    const sdk = createOptimizationSdk()

    sdk.getMergeTagValue = function (
      embeddedEntryNodeTarget,
    ): ReturnType<OptimizationSdk['getMergeTagValue']> {
      getMergeTagValueCalls.push([this === sdk, embeddedEntryNodeTarget])
      return 'EU'
    }

    function Probe(): null {
      capturedResolver = useMergeTagResolver()
      return null
    }

    renderToString(
      <OptimizationContext.Provider value={{ sdk, isReady: true, error: undefined }}>
        <Probe />
      </OptimizationContext.Provider>,
    )

    const resolver = requireMergeTagResolver(capturedResolver)

    expect(resolver.getMergeTagValue(mergeTagEntry)).toBe('EU')
    expect(getMergeTagValueCalls).toEqual([[true, mergeTagEntry]])
  })
})
