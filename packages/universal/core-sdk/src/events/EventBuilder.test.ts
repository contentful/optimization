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
