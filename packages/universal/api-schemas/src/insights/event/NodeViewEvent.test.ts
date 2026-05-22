import { describe, expect, it } from '@rstest/core'
import { InsightsEvent } from './InsightsEvent'
import { NodeViewEvent } from './NodeViewEvent'

const BASE_UNIVERSAL = {
  channel: 'web' as const,
  context: {
    campaign: {},
    gdpr: { isConsentGiven: true },
    library: { name: 'test', version: '0.0.0' },
    locale: 'en-US',
  },
  messageId: 'msg-1',
  originalTimestamp: '2024-01-01T00:00:00.000Z',
  sentAt: '2024-01-01T00:00:00.000Z',
  timestamp: '2024-01-01T00:00:00.000Z',
}

const VALID_NODE_VIEW = {
  ...BASE_UNIVERSAL,
  anonymousId: 'anon-id',
  type: 'exo_view' as const,
  entityId: 'exp-sys-id',
  entityKind: 'Experience' as const,
  variant: 'variant-a',
  optimizationId: 'opt-id',
  viewId: 'view-uuid',
  viewDurationMs: 1500,
}

describe('NodeViewEvent schema', () => {
  it('accepts a valid payload', () => {
    const result = NodeViewEvent.safeParse(VALID_NODE_VIEW)

    expect(result.success).toBe(true)
  })

  it('accepts all valid entityKind values', () => {
    const kinds = ['Experience', 'Fragment', 'InlineFragment', 'InlineComponent'] as const

    for (const entityKind of kinds) {
      const result = NodeViewEvent.safeParse({ ...VALID_NODE_VIEW, entityKind })

      expect(result.success, `entityKind=${entityKind}`).toBe(true)
    }
  })

  it('rejects an unknown entityKind', () => {
    const result = NodeViewEvent.safeParse({ ...VALID_NODE_VIEW, entityKind: 'Unknown' })

    expect(result.success).toBe(false)
  })

  it('rejects a missing required field', () => {
    const { entityId: _removed, ...withoutEntityId } = VALID_NODE_VIEW
    const result = NodeViewEvent.safeParse(withoutEntityId)

    expect(result.success).toBe(false)
  })

  it('rejects a non-number viewDurationMs', () => {
    const result = NodeViewEvent.safeParse({ ...VALID_NODE_VIEW, viewDurationMs: 'long' })

    expect(result.success).toBe(false)
  })
})

describe('InsightsEvent discriminated union', () => {
  it('discriminates exo_view correctly', () => {
    const result = InsightsEvent.safeParse(VALID_NODE_VIEW)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe('exo_view')
    }
  })
})
