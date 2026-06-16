import ElementExistenceObserver from './ElementExistenceObserver'
import { EntryElementRegistry } from './EntryElementRegistry'

type ElementExistenceObserverSubscriber = Parameters<ElementExistenceObserver['subscribe']>[0]

interface MockElementExistenceObserver {
  readonly observer: ElementExistenceObserver
  readonly cleanup: ReturnType<typeof rs.fn>
  getSubscriber: () => ElementExistenceObserverSubscriber | undefined
}

class StubElementExistenceObserver extends ElementExistenceObserver {
  public capturedSubscriber?: ElementExistenceObserverSubscriber
  public readonly cleanup = rs.fn()

  public override subscribe(subscriber: ElementExistenceObserverSubscriber): () => void {
    this.capturedSubscriber = subscriber
    return this.cleanup
  }
}

function createMockExistenceObserver(): MockElementExistenceObserver {
  const observer = new StubElementExistenceObserver()

  return {
    observer,
    cleanup: observer.cleanup,
    getSubscriber: () => observer.capturedSubscriber,
  }
}

function createEntryElement(id: string): HTMLDivElement {
  const entry = document.createElement('div')
  entry.dataset.ctflEntryId = id
  return entry
}

describe('EntryElementRegistry', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
    rs.restoreAllMocks()
  })

  it('isolates thrown onAdded errors so other subscribers still receive the same entry', () => {
    const { observer, getSubscriber } = createMockExistenceObserver()
    const registry = new EntryElementRegistry(observer)

    const throwingOnAdded = rs.fn(() => {
      throw new Error('added-failure')
    })
    const onAddedError = rs.fn()
    const receivingOnAdded = rs.fn()

    registry.subscribe({ onAdded: throwingOnAdded, onError: onAddedError })
    registry.subscribe({ onAdded: receivingOnAdded })

    const existenceSubscriber = getSubscriber()

    if (!existenceSubscriber?.onAdded) {
      throw new Error('Expected registry to register an onAdded existence subscriber')
    }

    const entry = createEntryElement('entry-added')
    existenceSubscriber.onAdded([entry])

    expect(throwingOnAdded).toHaveBeenCalledTimes(1)
    expect(onAddedError).toHaveBeenCalledTimes(1)
    expect(receivingOnAdded).toHaveBeenCalledTimes(1)
    expect(receivingOnAdded).toHaveBeenCalledWith(entry)

    registry.disconnect()
  })

  it('isolates thrown onRemoved errors so other subscribers still receive the same removal', () => {
    const { observer, getSubscriber } = createMockExistenceObserver()
    const registry = new EntryElementRegistry(observer)

    const throwingOnRemoved = rs.fn(() => {
      throw new Error('removed-failure')
    })
    const onRemovedError = rs.fn()
    const receivingOnRemoved = rs.fn()

    registry.subscribe({ onRemoved: throwingOnRemoved, onError: onRemovedError })
    registry.subscribe({ onRemoved: receivingOnRemoved })

    const existenceSubscriber = getSubscriber()

    if (!existenceSubscriber?.onAdded || !existenceSubscriber.onRemoved) {
      throw new Error('Expected registry to register onAdded/onRemoved existence subscribers')
    }

    const entry = createEntryElement('entry-removed')
    existenceSubscriber.onAdded([entry])
    existenceSubscriber.onRemoved([entry])

    expect(throwingOnRemoved).toHaveBeenCalledTimes(1)
    expect(onRemovedError).toHaveBeenCalledTimes(1)
    expect(receivingOnRemoved).toHaveBeenCalledTimes(1)
    expect(receivingOnRemoved).toHaveBeenCalledWith(entry)

    registry.disconnect()
  })

  it('resolves nested entry elements from mutation containers', () => {
    const { observer, getSubscriber } = createMockExistenceObserver()
    const registry = new EntryElementRegistry(observer)
    const onAdded = rs.fn()
    const onRemoved = rs.fn()

    registry.subscribe({ onAdded, onRemoved })

    const existenceSubscriber = getSubscriber()

    if (!existenceSubscriber?.onAdded || !existenceSubscriber.onRemoved) {
      throw new Error('Expected registry to register onAdded/onRemoved existence subscribers')
    }

    const container = document.createElement('section')
    const nested = createEntryElement('nested-entry')
    container.append(nested)

    existenceSubscriber.onAdded([container])
    expect(onAdded).toHaveBeenCalledTimes(1)
    expect(onAdded).toHaveBeenCalledWith(nested)

    existenceSubscriber.onRemoved([container])
    expect(onRemoved).toHaveBeenCalledTimes(1)
    expect(onRemoved).toHaveBeenCalledWith(nested)

    registry.disconnect()
  })

  it('stops observer subscription only after the last subscriber unsubscribes', () => {
    const { cleanup, observer } = createMockExistenceObserver()
    const registry = new EntryElementRegistry(observer)

    const unsubscribeA = registry.subscribe({})
    const unsubscribeB = registry.subscribe({})

    unsubscribeA()
    expect(cleanup).not.toHaveBeenCalled()

    unsubscribeB()
    expect(cleanup).toHaveBeenCalledTimes(1)

    registry.disconnect()
  })

  it('calls existence cleanup when disconnect is invoked', () => {
    const { cleanup, observer } = createMockExistenceObserver()
    const registry = new EntryElementRegistry(observer)

    registry.subscribe({})
    registry.disconnect()

    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('seeds existing DOM entries to subscribers when first subscribed', () => {
    const seeded = createEntryElement('seeded')
    const ignored = document.createElement('div')
    document.body.append(seeded, ignored)

    const { observer } = createMockExistenceObserver()
    const registry = new EntryElementRegistry(observer)
    const onAdded = rs.fn()

    registry.subscribe({ onAdded })

    expect(onAdded).toHaveBeenCalledTimes(1)
    expect(onAdded).toHaveBeenCalledWith(seeded)

    registry.disconnect()
  })

  it('replays already-seen entries to a late subscriber without re-seeding', () => {
    const { observer, getSubscriber } = createMockExistenceObserver()
    const registry = new EntryElementRegistry(observer)
    const earlyOnAdded = rs.fn()
    registry.subscribe({ onAdded: earlyOnAdded })

    const existenceSubscriber = getSubscriber()
    if (!existenceSubscriber?.onAdded) {
      throw new Error('Expected registry to register an onAdded existence subscriber')
    }

    const entry = createEntryElement('replayed')
    existenceSubscriber.onAdded([entry])
    expect(earlyOnAdded).toHaveBeenCalledTimes(1)

    const lateOnAdded = rs.fn()
    registry.subscribe({ onAdded: lateOnAdded })

    expect(lateOnAdded).toHaveBeenCalledTimes(1)
    expect(lateOnAdded).toHaveBeenCalledWith(entry)

    registry.disconnect()
  })

  it('ignores duplicate add notifications for entries already in the registry', () => {
    const { observer, getSubscriber } = createMockExistenceObserver()
    const registry = new EntryElementRegistry(observer)
    const onAdded = rs.fn()
    registry.subscribe({ onAdded })

    const existenceSubscriber = getSubscriber()
    if (!existenceSubscriber?.onAdded) {
      throw new Error('Expected registry to register an onAdded existence subscriber')
    }

    const entry = createEntryElement('duplicate')
    existenceSubscriber.onAdded([entry])
    existenceSubscriber.onAdded([entry])

    expect(onAdded).toHaveBeenCalledTimes(1)

    registry.disconnect()
  })

  it('registers an entry when the entry id attribute is added after subscription', () => {
    const { observer, getSubscriber } = createMockExistenceObserver()
    const registry = new EntryElementRegistry(observer)
    const onAdded = rs.fn()
    registry.subscribe({ onAdded })

    const existenceSubscriber = getSubscriber()
    if (!existenceSubscriber?.onAdded || !existenceSubscriber.onRemoved) {
      throw new Error('Expected registry to register onAdded/onRemoved existence subscribers')
    }

    const entry = document.createElement('div')
    entry.dataset.ctflEntryId = 'late-entry'

    existenceSubscriber.onRemoved([entry])
    existenceSubscriber.onAdded([entry])

    expect(onAdded).toHaveBeenCalledTimes(1)
    expect(onAdded).toHaveBeenCalledWith(entry)

    registry.disconnect()
  })

  it('unregisters an entry when the entry id attribute is removed after subscription', () => {
    const { observer, getSubscriber } = createMockExistenceObserver()
    const registry = new EntryElementRegistry(observer)
    const onAdded = rs.fn()
    const onRemoved = rs.fn()
    registry.subscribe({ onAdded, onRemoved })

    const existenceSubscriber = getSubscriber()
    if (!existenceSubscriber?.onAdded || !existenceSubscriber.onRemoved) {
      throw new Error('Expected registry to register onAdded/onRemoved existence subscribers')
    }

    const entry = createEntryElement('removed-entry-id')
    existenceSubscriber.onAdded([entry])

    delete entry.dataset.ctflEntryId
    existenceSubscriber.onRemoved([entry])
    existenceSubscriber.onAdded([entry])

    expect(onAdded).toHaveBeenCalledTimes(1)
    expect(onRemoved).toHaveBeenCalledTimes(1)
    expect(onRemoved).toHaveBeenCalledWith(entry)

    registry.disconnect()
  })

  it('ignores remove notifications for entries that were never added', () => {
    const { observer, getSubscriber } = createMockExistenceObserver()
    const registry = new EntryElementRegistry(observer)
    const onRemoved = rs.fn()
    registry.subscribe({ onRemoved })

    const existenceSubscriber = getSubscriber()
    if (!existenceSubscriber?.onRemoved) {
      throw new Error('Expected registry to register an onRemoved existence subscriber')
    }

    existenceSubscriber.onRemoved([createEntryElement('never-added')])

    expect(onRemoved).not.toHaveBeenCalled()

    registry.disconnect()
  })

  it('skips mutation elements that are neither entries nor contain nested entries', () => {
    const { observer, getSubscriber } = createMockExistenceObserver()
    const registry = new EntryElementRegistry(observer)
    const onAdded = rs.fn()
    const onRemoved = rs.fn()
    registry.subscribe({ onAdded, onRemoved })

    const existenceSubscriber = getSubscriber()
    if (!existenceSubscriber?.onAdded || !existenceSubscriber.onRemoved) {
      throw new Error('Expected registry to register onAdded/onRemoved existence subscribers')
    }

    const plain = document.createElement('div')

    existenceSubscriber.onAdded([plain])
    existenceSubscriber.onRemoved([plain])

    expect(onAdded).not.toHaveBeenCalled()
    expect(onRemoved).not.toHaveBeenCalled()

    registry.disconnect()
  })

  it('omits notifications for subscribers that do not provide a callback', () => {
    const { observer, getSubscriber } = createMockExistenceObserver()
    const registry = new EntryElementRegistry(observer)
    const onAddedOnly = rs.fn()
    const onRemovedOnly = rs.fn()
    registry.subscribe({ onAdded: onAddedOnly })
    registry.subscribe({ onRemoved: onRemovedOnly })

    const existenceSubscriber = getSubscriber()
    if (!existenceSubscriber?.onAdded || !existenceSubscriber.onRemoved) {
      throw new Error('Expected registry to register onAdded/onRemoved existence subscribers')
    }

    const entry = createEntryElement('partial-subscribers')
    existenceSubscriber.onAdded([entry])
    existenceSubscriber.onRemoved([entry])

    expect(onAddedOnly).toHaveBeenCalledTimes(1)
    expect(onRemovedOnly).toHaveBeenCalledTimes(1)

    registry.disconnect()
  })
})
