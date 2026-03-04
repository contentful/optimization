import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core'
import ElementExistenceObserver from './ElementExistenceObserver'

type MinimalRecord = Readonly<{
  addedNodes: readonly Node[]
  removedNodes: readonly Node[]
}>

class MOStub {
  private readonly cb: (records: readonly MinimalRecord[]) => void

  public constructor(callback: (records: readonly MinimalRecord[]) => void) {
    this.cb = callback
    instances.push(this)
  }

  public observe(): void {
    /* no-op */
  }

  public disconnect(): void {
    /* no-op */
  }

  public emit(records: readonly MinimalRecord[]): void {
    this.cb(records)
  }
}

const instances: MOStub[] = []

describe('ElementExistenceObserver', () => {
  let originalMO: typeof MutationObserver

  beforeEach(() => {
    ;({ MutationObserver: originalMO } = window)
    rs.stubGlobal('MutationObserver', MOStub)
    instances.length = 0
    document.body.innerHTML = ''
  })

  afterEach(() => {
    rs.restoreAllMocks()
    rs.stubGlobal('MutationObserver', originalMO)
    document.body.innerHTML = ''
  })

  it('is active in a DOM environment and observes subtree', () => {
    const root = document.createElement('div')
    document.body.append(root)

    const onAdded = rs.fn()
    const eo = new ElementExistenceObserver({ root, onAdded })

    const child = document.createElement('div')
    root.append(child)

    const [mo] = instances
    mo?.emit([{ addedNodes: [child], removedNodes: [] }])

    expect(onAdded).toHaveBeenCalledTimes(1)
    const {
      mock: { calls: [[elements = []] = []] = [] },
    } = onAdded
    expect(elements).toEqual([child])

    eo.disconnect()
  })

  it('lazily observes when a subscriber is added and stops dispatch after cleanup', () => {
    const root = document.createElement('div')
    document.body.append(root)

    const eo = new ElementExistenceObserver({ root })
    const onAdded = rs.fn()
    const unsubscribe = eo.subscribe({ onAdded })

    expect(instances).toHaveLength(1)

    const [mo] = instances
    const first = document.createElement('div')
    root.append(first)
    mo?.emit([{ addedNodes: [first], removedNodes: [] }])
    expect(onAdded).toHaveBeenCalledTimes(1)

    unsubscribe()
    const second = document.createElement('div')
    root.append(second)
    mo?.emit([{ addedNodes: [second], removedNodes: [] }])
    expect(onAdded).toHaveBeenCalledTimes(1)

    eo.disconnect()
  })

  it('supports explicit unsubscribe with the original subscriber reference', () => {
    const root = document.createElement('div')
    document.body.append(root)

    const subscriber = { onAdded: () => undefined }
    const eo = new ElementExistenceObserver({ root })

    eo.subscribe(subscriber)

    eo.unsubscribe(subscriber)

    eo.disconnect()
  })

  it('multicasts to all subscribers', () => {
    const root = document.createElement('div')
    document.body.append(root)

    const onAddedA = rs.fn()
    const onAddedB = rs.fn()

    const eo = new ElementExistenceObserver({ root })
    eo.subscribe({ onAdded: onAddedA })
    eo.subscribe({ onAdded: onAddedB })

    const [mo] = instances
    const el = document.createElement('div')
    root.append(el)
    mo?.emit([{ addedNodes: [el], removedNodes: [] }])

    expect(onAddedA).toHaveBeenCalledTimes(1)
    expect(onAddedB).toHaveBeenCalledTimes(1)

    eo.disconnect()
  })

  it('delivers removed callbacks before added callbacks', () => {
    const root = document.createElement('div')
    document.body.append(root)

    const events: string[] = []
    const eo = new ElementExistenceObserver({
      root,
      onRemoved: () => {
        events.push('removed')
      },
      onAdded: () => {
        events.push('added')
      },
    })
    const [mo] = instances

    const addedEl = document.createElement('span')
    root.append(addedEl)
    mo?.emit([{ addedNodes: [addedEl], removedNodes: [] }])
    expect(events).toEqual(['added'])

    events.length = 0
    const removedEl = document.createElement('em')
    root.append(removedEl)
    mo?.emit([{ addedNodes: [], removedNodes: [removedEl] }])
    expect(events).toEqual(['removed'])

    eo.disconnect()
  })

  it('coalesces moves (reparent/reorder) so no add/remove delivered', () => {
    const root = document.createElement('div')
    document.body.append(root)

    const onAdded = rs.fn()
    const onRemoved = rs.fn()
    const eo = new ElementExistenceObserver({ root, onAdded, onRemoved })
    const [mo] = instances

    const el = document.createElement('i')
    root.append(el)
    mo?.emit([{ addedNodes: [el], removedNodes: [] }])
    expect(onAdded).toHaveBeenCalledTimes(1)

    onAdded.mockClear()
    onRemoved.mockClear()

    mo?.emit([
      { addedNodes: [], removedNodes: [el] },
      { addedNodes: [el], removedNodes: [] },
    ])

    expect(onAdded).toHaveBeenCalledTimes(0)
    expect(onRemoved).toHaveBeenCalledTimes(0)

    eo.disconnect()
  })

  it('filters to Elements (ignores non-Element nodes)', () => {
    const root = document.createElement('div')
    document.body.append(root)

    const onAdded = rs.fn()
    const onRemoved = rs.fn()
    const eo = new ElementExistenceObserver({ root, onAdded, onRemoved })
    const [mo] = instances

    const text = document.createTextNode('hello')
    root.append(text)
    mo?.emit([{ addedNodes: [text], removedNodes: [] }])

    expect(onAdded).toHaveBeenCalledTimes(0)
    expect(onRemoved).toHaveBeenCalledTimes(0)

    eo.disconnect()
  })

  it('reports sync and async callback errors via onError', async () => {
    const root = document.createElement('div')
    document.body.append(root)

    const onError = rs.fn()
    const onRemoved = rs.fn(async () => await Promise.reject(new Error('async-removed')))
    const onAdded = rs.fn(() => {
      throw new Error('sync-added')
    })

    const eo = new ElementExistenceObserver({
      root,
      onAdded,
      onRemoved,
      onError,
    })
    const [mo] = instances

    const added = document.createElement('div')
    const removed = document.createElement('span')
    root.append(added, removed)

    mo?.emit([{ addedNodes: [added], removedNodes: [removed] }])

    await Promise.resolve()
    await Promise.resolve()

    expect(onError).toHaveBeenCalledTimes(2)

    eo.disconnect()
  })
})
