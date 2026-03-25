import {
  CHANGES_CACHE_KEY,
  PROFILE_CACHE_KEY,
  SELECTED_OPTIMIZATIONS_CACHE_KEY,
} from '@contentful/optimization-core/constants'
import { beforeEach, describe, expect, it, rs } from '@rstest/core'

interface AsyncStorageStoreInstance {
  initialize: () => Promise<void>
  readonly changes: unknown
  readonly profile: unknown
  readonly selectedOptimizations: unknown
}

const asyncStorageMock = {
  multiGet: rs.fn(),
  removeItem: rs.fn(),
  setItem: rs.fn(),
}

rs.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorageMock,
}))

function isAsyncStorageStoreInstance(value: unknown): value is AsyncStorageStoreInstance {
  if (typeof value !== 'object' || value === null) return false

  const initialize = Reflect.get(value, 'initialize')

  return typeof initialize === 'function'
}

async function getStore(): Promise<AsyncStorageStoreInstance> {
  const module = await import('./AsyncStorageStore')
  const store: unknown = module.default

  if (!isAsyncStorageStoreInstance(store)) {
    throw new TypeError('Expected AsyncStorageStore default export to be a store instance')
  }

  return store
}

function getCache(store: AsyncStorageStoreInstance): Map<unknown, unknown> {
  const cache: unknown = Reflect.get(store, 'cache')
  if (!(cache instanceof Map)) {
    throw new TypeError('Expected AsyncStorageStore cache to be a Map')
  }

  return cache
}

describe('AsyncStorageStore', () => {
  beforeEach(async () => {
    rs.clearAllMocks()

    asyncStorageMock.multiGet.mockResolvedValue([])
    asyncStorageMock.removeItem.mockResolvedValue(undefined)
    asyncStorageMock.setItem.mockResolvedValue(undefined)

    const store = await getStore()
    Reflect.set(store, 'initialized', false)
    const cache = getCache(store)
    cache.clear()
  })

  it('deletes malformed JSON cache values during initialization', async () => {
    asyncStorageMock.multiGet.mockResolvedValue([[CHANGES_CACHE_KEY, '{bad-json']])

    const store = await getStore()
    await store.initialize()

    expect(store.changes).toBeUndefined()
    expect(asyncStorageMock.removeItem).toHaveBeenCalledWith(CHANGES_CACHE_KEY)
  })

  it('deletes cache values that fail schema validation during initialization', async () => {
    asyncStorageMock.multiGet.mockResolvedValue([
      [PROFILE_CACHE_KEY, JSON.stringify({ foo: 'bar' })],
    ])

    const store = await getStore()
    await store.initialize()

    expect(store.profile).toBeUndefined()
    expect(asyncStorageMock.removeItem).toHaveBeenCalledWith(PROFILE_CACHE_KEY)
  })

  it('deletes in-memory structured cache values that fail schema validation', async () => {
    const store = await getStore()
    const cache = getCache(store)

    cache.set(SELECTED_OPTIMIZATIONS_CACHE_KEY, { foo: 'bar' })

    expect(store.selectedOptimizations).toBeUndefined()
    expect(cache.has(SELECTED_OPTIMIZATIONS_CACHE_KEY)).toBe(false)
    expect(asyncStorageMock.removeItem).toHaveBeenCalledWith(SELECTED_OPTIMIZATIONS_CACHE_KEY)
  })

  it('swallows AsyncStorage.removeItem failures when invalidating bad cache', async () => {
    asyncStorageMock.removeItem.mockRejectedValueOnce(new Error('storage blocked'))

    const store = await getStore()
    const cache = getCache(store)

    cache.set(SELECTED_OPTIMIZATIONS_CACHE_KEY, { foo: 'bar' })

    expect(() => {
      void store.selectedOptimizations
    }).not.toThrow()
    await Promise.resolve()
    expect(cache.has(SELECTED_OPTIMIZATIONS_CACHE_KEY)).toBe(false)
    expect(asyncStorageMock.removeItem).toHaveBeenCalledWith(SELECTED_OPTIMIZATIONS_CACHE_KEY)
  })
})
