import {
  ExperienceEventArray,
  type ExperienceEvent,
  type InsightsEvent,
} from '@contentful/optimization-api-client/api-schemas'

const MAX_PREPARED_EVENTS = 100
const MAX_IDENTIFY_EVENTS = 50

export function validatePreparedEvents(events: readonly unknown[]): ExperienceEventArray {
  const validEvents = ExperienceEventArray.parse(events)
  if (
    validEvents.length > MAX_PREPARED_EVENTS ||
    validEvents.filter(({ type }) => type === 'identify').length > MAX_IDENTIFY_EVENTS ||
    validEvents.at(-1)?.type !== 'page' ||
    validEvents.slice(0, -1).some(({ type }) => type !== 'identify' && type !== 'track')
  ) {
    throw new TypeError(
      'A handoff requires at most 100 identify/track/page events, at most 50 identifies, and exactly one final page.',
    )
  }
  return validEvents
}

export function withEventConsent<TEvent extends ExperienceEvent | InsightsEvent>(
  event: TEvent,
  isConsentGiven: boolean,
): TEvent {
  return {
    ...event,
    context: { ...event.context, gdpr: { ...event.context.gdpr, isConsentGiven } },
  }
}
