import { buildAutoPagePayload, composePagePayload } from './pagePayload'
import type { AutoPagePayload } from './types'

describe('composePagePayload', () => {
  it('returns an empty object when no layers are supplied', () => {
    expect(composePagePayload()).toEqual({})
  })

  it('skips undefined layers', () => {
    const result = composePagePayload(undefined, { properties: { a: 1 } }, undefined)

    expect(result).toEqual({ properties: { a: 1 } })
  })

  it('deep-merges layers with later precedence on conflict', () => {
    const result = composePagePayload(
      { properties: { a: 1, b: 2 } },
      { properties: { b: 99 } },
      { properties: { c: 3 } },
    )

    expect(result).toEqual({ properties: { a: 1, b: 99, c: 3 } })
  })

  it('replaces non-object values rather than merging them', () => {
    const result = composePagePayload(
      { properties: { tags: ['a', 'b'] } },
      { properties: { tags: ['c'] } },
    )

    expect(result).toEqual({ properties: { tags: ['c'] } })
  })
})

describe('buildAutoPagePayload', () => {
  const context = {
    isInitialEmission: true,
    routeKey: '/x',
    context: { foo: 'bar' },
  }

  it('returns the router payload when no consumer overrides are supplied', () => {
    const routerPayload: AutoPagePayload = {
      properties: { path: '/x', url: 'https://example.com/x' },
    }

    const result = buildAutoPagePayload(routerPayload, {}, context)

    expect(result).toEqual(routerPayload)
  })

  it('lets consumer static pagePayload override router payload keys', () => {
    const routerPayload: AutoPagePayload = {
      properties: { path: '/x', source: 'router' },
    }

    const result = buildAutoPagePayload(
      routerPayload,
      { pagePayload: { properties: { source: 'static' } } },
      context,
    )

    expect(result).toEqual({ properties: { path: '/x', source: 'static' } })
  })

  it('lets consumer dynamic getPagePayload override both router and static layers', () => {
    const routerPayload: AutoPagePayload = {
      properties: { path: '/x', source: 'router' },
    }

    const result = buildAutoPagePayload(
      routerPayload,
      {
        pagePayload: { properties: { source: 'static' } },
        getPagePayload: () => ({ properties: { source: 'dynamic' } }),
      },
      context,
    )

    expect(result).toEqual({ properties: { path: '/x', source: 'dynamic' } })
  })

  it('forwards the emission context to getPagePayload', () => {
    const routerPayload: AutoPagePayload = { properties: {} }
    let captured: typeof context | undefined

    buildAutoPagePayload(
      routerPayload,
      {
        getPagePayload: (received) => {
          captured = received as typeof context
          return undefined
        },
      },
      context,
    )

    expect(captured).toBe(context)
  })

  it('treats getPagePayload returning undefined as no override', () => {
    const routerPayload: AutoPagePayload = { properties: { source: 'router' } }

    const result = buildAutoPagePayload(routerPayload, { getPagePayload: () => undefined }, context)

    expect(result).toEqual({ properties: { source: 'router' } })
  })
})
