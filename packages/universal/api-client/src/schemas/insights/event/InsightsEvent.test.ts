import { BatchInsightsEvent } from './BatchInsightsEvent'
import { InsightsEvent } from './InsightsEvent'

const universalEventProperties = {
  channel: 'web',
  context: {
    campaign: {},
    library: { name: '@contentful/optimization-web', version: '1.0.0' },
  },
  messageId: 'message-1',
  originalTimestamp: '2026-11-06T10:00:00.000Z',
  sentAt: '2026-11-06T10:00:00.000Z',
  timestamp: '2026-11-06T10:00:00.000Z',
} as const

const interaction = {
  ...universalEventProperties,
  componentId: 'entry-1',
  componentType: 'Entry',
  experienceId: 'experience-1',
  variantIndex: 1,
} as const

const { componentType: _componentType, variantIndex: _variantIndex, ...unattributed } = interaction

const events = {
  component: { ...unattributed, type: 'component' },
  component_click: { ...unattributed, type: 'component_click' },
  component_hover: {
    ...unattributed,
    type: 'component_hover',
    hoverDurationMs: 500,
    hoverId: 'hover-1',
  },
} as const

const profile = {
  id: 'profile-1',
  stableId: 'profile-1',
  random: 0.5,
  audiences: [],
  traits: {},
  location: {},
  session: {
    isReturningVisitor: false,
    landingPage: { path: '/', query: {}, referrer: '', search: '', url: 'https://example.com/' },
    count: 1,
    activeSessionLength: 0,
    averageSessionLength: 0,
  },
}

describe('Insights component interaction events', () => {
  it.each(Object.entries(events))(
    'accepts a %s event without componentType and variantIndex',
    (_type, event) => {
      expect(InsightsEvent.safeParse(event).success).toBe(true)
    },
  )

  it.each(Object.entries(events))('still accepts a %s event that sets them', (_type, event) => {
    expect(
      InsightsEvent.safeParse({ ...event, componentType: 'Variable', variantIndex: 0 }).success,
    ).toBe(true)
  })

  it('accepts a batch of these events for a profile', () => {
    expect(BatchInsightsEvent.safeParse({ profile, events: Object.values(events) }).success).toBe(
      true,
    )
  })

  it('still requires componentId', () => {
    const { componentId: _componentId, ...event } = events.component_click

    expect(InsightsEvent.safeParse(event).success).toBe(false)
  })

  it('still requires hoverId on hover events', () => {
    const { hoverId: _hoverId, ...event } = events.component_hover

    expect(InsightsEvent.safeParse(event).success).toBe(false)
  })
})
