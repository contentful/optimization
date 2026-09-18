import {
  ExoNodeClickEvent,
  ExoNodeEntityKind,
  ExoNodeHoverEvent,
  ExoNodeViewEvent,
} from './ExoNodeEvent'
import { InsightsEvent } from './InsightsEvent'

const universalEventProperties = {
  channel: 'web',
  context: {
    campaign: {},
    gdpr: { isConsentGiven: true },
    library: { name: '@contentful/optimization-web', version: '1.0.0' },
    locale: 'en-US',
  },
  messageId: 'message-1',
  originalTimestamp: '2026-02-01T10:15:00.000Z',
  sentAt: '2026-02-01T10:15:00.000Z',
  timestamp: '2026-02-01T10:15:00.000Z',
} as const

const exoNodeProperties = {
  ...universalEventProperties,
  entityId: 'experience-123',
  entityKind: 'Experience',
  entityKindId: 'template-123',
  entryIds: ['entry-123', 'entry-456'],
  optimizationId: 'optimization-123',
  parameters: {
    market: 'US',
    isReturningVisitor: false,
    slots: ['hero', 'recommendations'],
  },
  parentExperienceId: 'parent-experience-123',
  variantId: 'variant-a',
  variantIndex: 1,
} as const

describe('ExO node Insights events', () => {
  it.each(['Experience', 'Fragment', 'InlineFragment', 'InlineComponent'])(
    'accepts the %s entity kind',
    (entityKind) => {
      expect(ExoNodeEntityKind.safeParse(entityKind).success).toBe(true)
    },
  )

  it('parses an exo_node_view event through the Insights event union', () => {
    const event = {
      ...exoNodeProperties,
      type: 'exo_node_view',
      viewDurationMs: 3000,
      viewId: 'view-123',
    }

    expect(ExoNodeViewEvent.safeParse(event).success).toBe(true)
    expect(InsightsEvent.safeParse(event).success).toBe(true)
  })

  it('parses an exo_node_click event through the Insights event union', () => {
    const event = {
      ...exoNodeProperties,
      type: 'exo_node_click',
    }

    expect(ExoNodeClickEvent.safeParse(event).success).toBe(true)
    expect(InsightsEvent.safeParse(event).success).toBe(true)
  })

  it('parses an exo_node_hover event through the Insights event union', () => {
    const event = {
      ...exoNodeProperties,
      type: 'exo_node_hover',
      hoverDurationMs: 1500,
      hoverId: 'hover-123',
    }

    expect(ExoNodeHoverEvent.safeParse(event).success).toBe(true)
    expect(InsightsEvent.safeParse(event).success).toBe(true)
  })

  it.each([
    { viewDurationMs: -1, viewId: 'view-123' },
    { viewDurationMs: 1.5, viewId: 'view-123' },
  ])('rejects an invalid view duration', (viewProperties) => {
    expect(
      ExoNodeViewEvent.safeParse({
        ...exoNodeProperties,
        type: 'exo_node_view',
        ...viewProperties,
      }).success,
    ).toBe(false)
  })

  it.each([
    { hoverDurationMs: -1, hoverId: 'hover-123' },
    { hoverDurationMs: 1.5, hoverId: 'hover-123' },
  ])('rejects an invalid hover duration', (hoverProperties) => {
    expect(
      ExoNodeHoverEvent.safeParse({
        ...exoNodeProperties,
        type: 'exo_node_hover',
        ...hoverProperties,
      }).success,
    ).toBe(false)
  })

  it('rejects an unknown entity kind', () => {
    expect(
      ExoNodeClickEvent.safeParse({
        ...exoNodeProperties,
        type: 'exo_node_click',
        entityKind: 'Entry',
      }).success,
    ).toBe(false)
  })
})
