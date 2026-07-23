import { describe, expect, it } from '@rstest/core'
import EventBuilder from './EventBuilder'

const builder = new EventBuilder({
  channel: 'mobile',
  library: { name: '@contentful/optimization-ios', version: '0.0.1' },
})

describe('EventBuilder.buildScreenView', () => {
  it('builds a valid screen event without an explicit screen context', () => {
    const event = builder.buildScreenView({ name: 'Home', properties: {} })

    expect(event.type).toBe('screen')
    expect(event.name).toBe('Home')
    expect(event.context.screen).toEqual(expect.objectContaining({ name: 'Home' }))
  })

  it('includes the screen name in event properties', () => {
    // The Experience API requires properties.name for screen events.
    const event = builder.buildScreenView({ name: 'Home', properties: {} })

    expect(event.properties).toEqual(expect.objectContaining({ name: 'Home' }))
  })

  it('marks GDPR consent as false when no event consent getter is configured', () => {
    const event = builder.buildScreenView({ name: 'Home', properties: {} })

    expect(event.context.gdpr.isConsentGiven).toBe(false)
  })

  it('uses the configured event consent getter for GDPR context', () => {
    const event = new EventBuilder({
      channel: 'mobile',
      library: { name: '@contentful/optimization-ios', version: '0.0.1' },
      getConsent: () => false,
    }).buildScreenView({ name: 'Home', properties: {} })

    expect(event.context.gdpr.isConsentGiven).toBe(false)
  })
})

describe('EventBuilder.buildPageView', () => {
  it('uses merged page event properties as context.page when no explicit page context is provided', () => {
    const event = new EventBuilder({
      channel: 'web',
      library: { name: '@contentful/optimization-web', version: '0.0.1' },
      getPageProperties: () => ({
        path: '/',
        query: {},
        referrer: '',
        search: '',
        title: 'Home',
        url: 'https://example.test/',
      }),
    }).buildPageView({
      properties: {
        path: '/products',
        query: { audience: 'beta' },
        search: '?audience=beta',
        url: 'https://example.test/products?audience=beta',
      },
    })

    expect(event.properties).toEqual(
      expect.objectContaining({
        path: '/products',
        query: { audience: 'beta' },
        search: '?audience=beta',
        title: 'Home',
        url: 'https://example.test/products?audience=beta',
      }),
    )
    expect(event.context.page).toEqual(event.properties)
  })

  it('preserves explicit page context precedence over merged page event properties', () => {
    const explicitPage = {
      path: '/context',
      query: { audience: 'context' },
      referrer: '',
      search: '?audience=context',
      title: 'Context',
      url: 'https://example.test/context?audience=context',
    }
    const event = new EventBuilder({
      channel: 'web',
      library: { name: '@contentful/optimization-web', version: '0.0.1' },
      getPageProperties: () => ({
        path: '/',
        query: {},
        referrer: '',
        search: '',
        title: 'Home',
        url: 'https://example.test/',
      }),
    }).buildPageView({
      page: explicitPage,
      properties: {
        path: '/properties',
        query: { audience: 'properties' },
        search: '?audience=properties',
        url: 'https://example.test/properties?audience=properties',
      },
    })

    expect(event.context.page).toEqual(explicitPage)
    expect(event.properties).toEqual(
      expect.objectContaining({
        path: '/properties',
        query: { audience: 'properties' },
        search: '?audience=properties',
        title: 'Home',
        url: 'https://example.test/properties?audience=properties',
      }),
    )
  })
})

describe('EventBuilder entry interactions', () => {
  it('accepts optimizationContextId without adding it to API events', () => {
    const view = builder.buildView({
      componentId: 'entry-1',
      optimizationContextId: 'ctx-1',
      variantIndex: 1,
      viewDurationMs: 100,
      viewId: 'view-1',
    })
    const click = builder.buildClick({
      componentId: 'entry-1',
      optimizationContextId: 'ctx-1',
      variantIndex: 1,
    })

    expect(view).not.toHaveProperty('optimizationContextId')
    expect(click).not.toHaveProperty('optimizationContextId')
  })
})

describe('EventBuilder.buildNodeView', () => {
  const baseArgs = {
    anonymousId: 'anon-1',
    entityId: 'entity-1',
    entityKind: 'Experience' as const,
    variantId: 'variant-a',
    variantIndex: 1,
    optimizationId: 'opt-1',
    viewId: 'view-1',
    viewDurationMs: 1_000,
  }

  it('builds an exo_node_view event carrying all node-view fields', () => {
    const event = builder.buildNodeView(baseArgs)

    expect(event.type).toBe('exo_node_view')
    expect(event.anonymousId).toBe('anon-1')
    expect(event.entityId).toBe('entity-1')
    expect(event.entityKind).toBe('Experience')
    expect(event.variantId).toBe('variant-a')
    expect(event.variantIndex).toBe(1)
    expect(event.optimizationId).toBe('opt-1')
    expect(event.viewId).toBe('view-1')
    expect(event.viewDurationMs).toBe(1_000)
  })

  it('includes parentExperienceId when supplied', () => {
    const event = builder.buildNodeView({
      ...baseArgs,
      parentExperienceId: 'parent-exp-1',
    })

    expect(event.parentExperienceId).toBe('parent-exp-1')
  })

  it('accepts entityKind = Fragment', () => {
    const event = builder.buildNodeView({ ...baseArgs, entityKind: 'Fragment' })

    expect(event.entityKind).toBe('Fragment')
  })

  it('rejects unknown entityKind values at parse time', () => {
    expect(() =>
      builder.buildNodeView({
        ...baseArgs,
        // @ts-expect-error — validate schema rejects unsupported kinds
        entityKind: 'Component',
      }),
    ).toThrow()
  })
})
