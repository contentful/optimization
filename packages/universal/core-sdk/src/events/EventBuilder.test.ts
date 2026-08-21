import type { Page } from '@contentful/optimization-api-client/api-schemas'
import { describe, expect, it } from '@rstest/core'
import EventBuilder from './EventBuilder'

const builder = new EventBuilder({
  channel: 'mobile',
  library: { name: '@contentful/optimization-ios', version: '0.0.1' },
})

function createPage(url: string, referrer = ''): Page {
  const parsedUrl = new URL(url)

  return {
    path: parsedUrl.pathname,
    query: Object.fromEntries(parsedUrl.searchParams),
    referrer,
    search: parsedUrl.search,
    url,
  }
}

describe('EventBuilder campaign attribution', () => {
  it('infers campaign attribution from the page URL and ignores the referrer URL', () => {
    const event = builder.buildTrack({
      event: 'cta_clicked',
      page: createPage(
        'https://example.test/?utm_campaign=Spring%20Sale&utm_source=newsletter&utm_medium=email&utm_term=shoes&utm_content=hero',
        'https://referrer.test/?utm_campaign=Ignored',
      ),
    })

    expect(event.context.campaign).toEqual({
      content: 'hero',
      medium: 'email',
      name: 'Spring Sale',
      source: 'newsletter',
      term: 'shoes',
    })
  })

  it('uses explicit campaign attribution instead of values inferred from the page URL', () => {
    const event = builder.buildTrack({
      campaign: { name: 'Explicit campaign' },
      event: 'cta_clicked',
      page: createPage('https://example.test/?utm_campaign=URL%20campaign&utm_source=newsletter'),
    })

    expect(event.context.campaign).toEqual({ name: 'Explicit campaign' })
  })

  it('does not infer campaign attribution from an invalid page URL', () => {
    const event = builder.buildTrack({
      event: 'cta_clicked',
      page: {
        path: '',
        query: {},
        referrer: 'https://referrer.test/?utm_campaign=Ignored',
        search: '',
        url: '',
      },
    })

    expect(event.context.campaign).toEqual({})
  })
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

  it('prefers campaign attribution from properties.url when both page URLs contain UTM parameters', () => {
    const event = new EventBuilder({
      channel: 'web',
      library: { name: '@contentful/optimization-web', version: '0.0.1' },
    }).buildPageView({
      page: createPage('https://example.test/context?utm_source=context&utm_medium=context-medium'),
      properties: {
        url: 'https://example.test/properties?utm_campaign=Properties%20campaign',
      },
    })

    expect(event.context.campaign).toEqual({ name: 'Properties campaign' })
  })

  it('uses campaign attribution from page.url when properties.url has no UTM parameters', () => {
    const event = new EventBuilder({
      channel: 'web',
      library: { name: '@contentful/optimization-web', version: '0.0.1' },
    }).buildPageView({
      page: createPage('https://example.test/context?utm_source=context'),
      properties: { url: 'https://example.test/properties' },
    })

    expect(event.context.campaign).toEqual({ source: 'context' })
  })

  it('does not infer campaign attribution from either page view referrer', () => {
    const event = new EventBuilder({
      channel: 'web',
      library: { name: '@contentful/optimization-web', version: '0.0.1' },
    }).buildPageView({
      page: createPage(
        'https://example.test/context',
        'https://referrer.test/?utm_campaign=Page%20referrer',
      ),
      properties: {
        referrer: 'https://referrer.test/?utm_campaign=Properties%20referrer',
        url: 'https://example.test/properties',
      },
    })

    expect(event.context.campaign).toEqual({})
  })

  it('infers campaign attribution from default page properties when no URL override is supplied', () => {
    const event = new EventBuilder({
      channel: 'web',
      library: { name: '@contentful/optimization-web', version: '0.0.1' },
      getPageProperties: () => createPage('https://example.test/?utm_campaign=Default%20campaign'),
    }).buildPageView()

    expect(event.context.campaign).toEqual({ name: 'Default campaign' })
  })

  it('does not fall back to the page provider after properties.url overrides it', () => {
    const event = new EventBuilder({
      channel: 'web',
      library: { name: '@contentful/optimization-web', version: '0.0.1' },
      getPageProperties: () => createPage('https://example.test/?utm_campaign=Default%20campaign'),
    }).buildPageView({ properties: { url: 'https://example.test/override' } })

    expect(event.context.campaign).toEqual({})
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
