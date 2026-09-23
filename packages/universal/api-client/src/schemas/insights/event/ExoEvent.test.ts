import {
  BatchExperienceEvent,
  ExoEntityKind,
  ExoEventProperties,
  ExoViewEvent,
  ExperienceEvent,
} from '../../experience/event'
import { ExoClickEvent } from './ExoClickEvent'
import { ExoHoverEvent } from './ExoHoverEvent'
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

const exoProperties = {
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

const { optimizationId, variantId, ...unattributedExoProperties } = exoProperties

describe('ExO events', () => {
  it.each(['Experience', 'Fragment', 'InlineFragment', 'InlineComponent'])(
    'accepts the %s entity kind',
    (entityKind) => {
      expect(ExoEntityKind.safeParse(entityKind).success).toBe(true)
    },
  )

  it('parses an exo_node_view event through the Experience and Insights event unions', () => {
    const event = {
      ...exoProperties,
      type: 'exo_node_view',
      viewDurationMs: 3000,
      viewId: 'view-123',
    }

    expect(ExoEventProperties.safeParse(event).success).toBe(true)
    expect(ExoViewEvent.safeParse(event).success).toBe(true)
    expect(ExperienceEvent.safeParse(event).success).toBe(true)
    expect(BatchExperienceEvent.safeParse({ ...event, anonymousId: 'profile-123' }).success).toBe(
      true,
    )
    expect(InsightsEvent.safeParse(event).success).toBe(true)
  })

  it('parses an exo_node_click event through the Insights event union', () => {
    const event = {
      ...exoProperties,
      type: 'exo_node_click',
    }

    expect(ExoClickEvent.safeParse(event).success).toBe(true)
    expect(InsightsEvent.safeParse(event).success).toBe(true)
  })

  it('parses an exo_node_hover event through the Insights event union', () => {
    const event = {
      ...exoProperties,
      type: 'exo_node_hover',
      hoverDurationMs: 1500,
      hoverId: 'hover-123',
    }

    expect(ExoHoverEvent.safeParse(event).success).toBe(true)
    expect(InsightsEvent.safeParse(event).success).toBe(true)
  })

  it.each([
    {
      type: 'exo_node_view',
      viewDurationMs: 3000,
      viewId: 'view-123',
    },
    { type: 'exo_node_click' },
    {
      type: 'exo_node_hover',
      hoverDurationMs: 1500,
      hoverId: 'hover-123',
    },
  ])('parses an unattributed $type event through the Insights event union', (event) => {
    expect(
      InsightsEvent.safeParse({
        ...unattributedExoProperties,
        ...event,
      }).success,
    ).toBe(true)
  })

  it('preserves attribution for a baseline selection', () => {
    const event = {
      ...exoProperties,
      type: 'exo_node_view',
      variantIndex: 0,
      viewDurationMs: 3000,
      viewId: 'view-123',
    }

    expect(ExoViewEvent.safeParse(event).success).toBe(true)
    expect(InsightsEvent.safeParse(event).success).toBe(true)
  })

  it.each([
    { viewDurationMs: -1, viewId: 'view-123' },
    { viewDurationMs: 1.5, viewId: 'view-123' },
  ])('rejects an invalid view duration', (viewProperties) => {
    expect(
      ExoViewEvent.safeParse({
        ...exoProperties,
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
      ExoHoverEvent.safeParse({
        ...exoProperties,
        type: 'exo_node_hover',
        ...hoverProperties,
      }).success,
    ).toBe(false)
  })

  it('rejects an unknown entity kind', () => {
    expect(
      ExoClickEvent.safeParse({
        ...exoProperties,
        type: 'exo_node_click',
        entityKind: 'Entry',
      }).success,
    ).toBe(false)
  })
})
