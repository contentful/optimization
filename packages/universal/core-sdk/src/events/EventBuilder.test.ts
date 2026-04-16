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
})
