const MAX_QUEUED_EVENTS = 25

type Batches<Key, EventType> = Array<[Key, EventType[]]>

export interface EventHandler<Key, EventType> {
  send: (p: Key, event: EventType) => Promise<void>
}

export class Stateful<Key, EventType> implements EventHandler<Key, EventType> {
  readonly #queue = new Map<Key, EventType[]>()

  private readonly handle: (profile: Batches<Key, EventType>) => Promise<void>

  constructor(handle: (profile: Batches<Key, EventType>) => Promise<void>) {
    this.handle = handle
  }

  async #flushMaxEvents(): Promise<void> {
    if (this.#queue.values().toArray().flat().length >= MAX_QUEUED_EVENTS) await this.flush()
  }

  async flush(): Promise<void> {
    const batches: Batches<Key, EventType> = []

    this.#queue.forEach((events, profile) => batches.push([profile, events]))

    await this.handle(batches)

    this.#queue.clear()
  }

  public async send(p: Key, validEvent: EventType): Promise<void> {
    const profileEventQueue = this.#queue.get(p)

    if (profileEventQueue) {
      profileEventQueue.push(validEvent)
    } else {
      this.#queue.set(p, [validEvent])
    }

    await this.#flushMaxEvents()
  }
}

export class Stateless<Key, EventType> implements EventHandler<Key, EventType> {
  private readonly handle: (profile: Batches<Key, EventType>) => Promise<void>

  constructor(handle: (profile: Batches<Key, EventType>) => Promise<void>) {
    this.handle = handle
  }

  async send(profile: Key, event: EventType): Promise<void> {
    await this.handle([[profile, [event]]])
  }
}
