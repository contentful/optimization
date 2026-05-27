import { describe, expect, it } from '@rstest/core'
import EventBuilder from './EventBuilder'

const builder = new EventBuilder({
  channel: 'mobile',
  library: { name: '@contentful/optimization-ios', version: '0.0.1' },
})

describe('EventBuilder.buildNodeView', () => {
  it('builds a valid exo_view event', () => {
    const event = builder.buildNodeView({
      anonymousId: 'anon-id',
      entityId: 'exp-sys-id',
      entityKind: 'Experience',
      variantId: 'variant-a',
      optimizationId: 'opt-id',
      viewId: 'view-uuid',
      viewDurationMs: 1500,
    })

    expect(event.type).toBe('exo_view')
    expect(event.anonymousId).toBe('anon-id')
    expect(event.entityId).toBe('exp-sys-id')
    expect(event.entityKind).toBe('Experience')
    expect(event.variantId).toBe('variant-a')
    expect(event.optimizationId).toBe('opt-id')
    expect(event.viewId).toBe('view-uuid')
    expect(event.viewDurationMs).toBe(1500)
    expect(event.channel).toBe('mobile')
  })

  it('stamps universal context fields', () => {
    const event = builder.buildNodeView({
      anonymousId: 'anon-id',
      entityId: 'exp-id',
      entityKind: 'Fragment',
      variantId: 'default',
      optimizationId: 'opt-id',
      viewId: 'view-uuid',
      viewDurationMs: 0,
    })

    expect(event.messageId).toBeTruthy()
    expect(event.timestamp).toBeTruthy()
    expect(event.context.library).toEqual({
      name: '@contentful/optimization-ios',
      version: '0.0.1',
    })
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
})
