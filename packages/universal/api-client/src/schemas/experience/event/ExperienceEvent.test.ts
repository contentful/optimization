import { BatchExperienceEvent, ExperienceEvent } from '.'

const page = {
  path: '/pricing',
  query: { utm_source: 'newsletter' },
  referrer: '',
  search: '?utm_source=newsletter',
  url: 'https://example.com/pricing?utm_source=newsletter',
}

const minimalContext = {
  campaign: {},
  library: { name: '@contentful/optimization-web', version: '1.0.0' },
}

const timestamps = {
  originalTimestamp: '2026-11-05T10:00:00.000Z',
  sentAt: '2026-11-05T10:00:00.000Z',
  timestamp: '2026-11-05T10:00:00.000Z',
}

const identify = {
  type: 'identify',
  channel: 'web',
  messageId: 'message-1',
  ...timestamps,
  userId: 'user-1',
  traits: {},
  context: minimalContext,
} as const

const pageView = {
  type: 'page',
  channel: 'web',
  messageId: 'message-2',
  ...timestamps,
  properties: { ...page, title: 'Pricing' },
  context: { ...minimalContext, page },
} as const

const component = {
  type: 'component',
  channel: 'web',
  messageId: 'message-3',
  ...timestamps,
  componentType: 'Entry',
  componentId: 'entry-1',
  variantIndex: 0,
  context: minimalContext,
} as const

describe('Experience API event alignment', () => {
  describe('context', () => {
    it('accepts events without gdpr and locale, as the Experience API does', () => {
      expect(ExperienceEvent.safeParse(identify).success).toBe(true)
    })

    it('still requires campaign', () => {
      const { campaign: _campaign, ...context } = minimalContext

      expect(ExperienceEvent.safeParse({ ...identify, context }).success).toBe(false)
    })

    it('defaults locale to en-US when omitted', () => {
      const result = ExperienceEvent.safeParse(identify)

      expect(result.success && result.data.context.locale).toBe('en-US')
    })

    it('keeps an explicit locale', () => {
      const result = ExperienceEvent.safeParse({
        ...identify,
        context: { ...minimalContext, locale: 'de-DE' },
      })

      expect(result.success && result.data.context.locale).toBe('de-DE')
    })
  })

  describe('timestamps', () => {
    it('accepts any date string for timestamp, sentAt and originalTimestamp', () => {
      const date = 'Thu, 05 Nov 2026 10:00:00 GMT'

      expect(
        ExperienceEvent.safeParse({
          ...identify,
          timestamp: date,
          sentAt: date,
          originalTimestamp: date,
        }).success,
      ).toBe(true)
    })

    it('still requires sentAt and originalTimestamp', () => {
      const { sentAt: _sentAt, ...withoutSentAt } = identify
      const { originalTimestamp: _originalTimestamp, ...withoutOriginal } = identify

      expect(ExperienceEvent.safeParse(withoutSentAt).success).toBe(false)
      expect(ExperienceEvent.safeParse(withoutOriginal).success).toBe(false)
    })
  })

  describe('anonymousId', () => {
    it('is optional on events', () => {
      expect(ExperienceEvent.safeParse(identify).success).toBe(true)
      expect(ExperienceEvent.safeParse({ ...identify, anonymousId: 'anonymous-1' }).success).toBe(
        true,
      )
    })

    it('is still required on batch events', () => {
      expect(BatchExperienceEvent.safeParse(identify).success).toBe(false)
      expect(
        BatchExperienceEvent.safeParse({ ...identify, anonymousId: 'anonymous-1' }).success,
      ).toBe(true)
    })
  })

  describe('page events', () => {
    it('accepts a page event without context.page', () => {
      expect(ExperienceEvent.safeParse({ ...pageView, context: minimalContext }).success).toBe(true)
    })

    it('requires properties.title', () => {
      const { title: _title, ...properties } = pageView.properties

      expect(ExperienceEvent.safeParse({ ...pageView, properties }).success).toBe(false)
    })

    it('accepts repeated query keys as arrays', () => {
      const repeated = { ...page, query: { tag: ['a', 'b'], utm_source: 'newsletter' } }

      expect(
        ExperienceEvent.safeParse({
          ...pageView,
          properties: { ...repeated, title: 'Pricing' },
          context: { ...minimalContext, page: repeated },
        }).success,
      ).toBe(true)
    })
  })

  describe('component events', () => {
    it('accepts events without componentType and variantIndex', () => {
      const { componentType: _componentType, variantIndex: _variantIndex, ...event } = component

      expect(ExperienceEvent.safeParse(event).success).toBe(true)
    })
  })

  describe('identify events', () => {
    it('requires userId', () => {
      const { userId: _userId, ...event } = identify

      expect(ExperienceEvent.safeParse(event).success).toBe(false)
    })
  })
})
