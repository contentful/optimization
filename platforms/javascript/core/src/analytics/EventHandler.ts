import type ApiClient from '../lib/api-client'
import type { Profile } from '../lib/api-client/experience/dto/profile/Profile'
import type { InsightsEvent } from '../lib/api-client/insights/dto/event'

const MAX_QUEUED_EVENTS = 25

interface Batch {
  profile: Profile
  events: InsightsEvent[]
}

export interface EventHandler {
  send: (p: Profile, event: InsightsEvent) => Promise<void>
}

export class EventHandlerStateful {
  readonly #queue = new Map<Profile, InsightsEvent[]>()

  api: ApiClient
  constructor(api: ApiClient) {
    this.api = api
  }

  async #flushMaxEvents(): Promise<void> {
    if (this.#queue.values().toArray().flat().length >= MAX_QUEUED_EVENTS) await this.flush()
  }

  async flush(): Promise<void> {
    const batches: Batch[] = []

    this.#queue.forEach((events, profile) => batches.push({ profile, events }))

    await this.api.insights.sendBatchEvents(batches)

    this.#queue.clear()
  }

  public async send(p: Profile, validEvent: InsightsEvent): Promise<void> {
    const profileEventQueue = this.#queue.get(p)

    if (profileEventQueue) {
      profileEventQueue.push(validEvent)
    } else {
      this.#queue.set(p, [validEvent])
    }

    await this.#flushMaxEvents()
  }
}

export class EventHandlerStateless implements EventHandler {
  api: ApiClient
  constructor(api: ApiClient) {
    this.api = api
  }

  async send(profile: Profile, validEvent: InsightsEvent): Promise<void> {
    await this.api.insights.sendBatchEvents([{ profile, events: [validEvent] }])
  }
}
