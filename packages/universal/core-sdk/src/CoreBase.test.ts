import { EXPERIENCE_BASE_URL } from '@contentful/optimization-api-client'
import type { ChangeArray, ExperienceEvent, InsightsEvent, PartialProfile } from './api-schemas'
import { OPTIMIZATION_CORE_SDK_NAME } from './constants'
import CoreBase, { type CoreConfig } from './CoreBase'
import { FlagsResolver } from './resolvers'

class TestCore extends CoreBase {
  lastExperienceCall:
    | {
        method: string
        args: readonly unknown[]
        event: ExperienceEvent
        profile?: PartialProfile
      }
    | undefined

  lastInsightsCall:
    | {
        method: string
        args: readonly unknown[]
        event: InsightsEvent
        profile?: PartialProfile
      }
    | undefined

  protected override async sendExperienceEvent(
    method: string,
    args: readonly unknown[],
    event: ExperienceEvent,
    profile?: PartialProfile,
  ): Promise<undefined> {
    await Promise.resolve()
    this.lastExperienceCall = { method, args, event, profile }
    return undefined
  }

  protected override async sendInsightsEvent(
    method: string,
    args: readonly unknown[],
    event: InsightsEvent,
    profile?: PartialProfile,
  ): Promise<void> {
    await Promise.resolve()
    this.lastInsightsCall = { method, args, event, profile }
  }
}

const CLIENT_ID = 'key_123'
const ENVIRONMENT = 'main'

const config: CoreConfig = {
  clientId: CLIENT_ID,
  environment: ENVIRONMENT,
}

const CHANGES: ChangeArray = [
  {
    key: 'dark-mode',
    type: 'Variable',
    value: true,
    meta: {
      experienceId: 'experience-id',
      variantIndex: 0,
    },
  },
  {
    key: 'price',
    type: 'Variable',
    value: {
      value: {
        amount: 10,
        currency: 'USD',
      },
    },
    meta: {
      experienceId: 'experience-id',
      variantIndex: 1,
    },
  },
]

describe('CoreBase', () => {
  it('allows access to the original configuration options', () => {
    const core = new TestCore(config)

    expect(core.config).toEqual(config)
    expect(core.eventBuilder.library.name).toEqual(OPTIMIZATION_CORE_SDK_NAME)
  })

  it('keeps insights and Experience client config isolated', () => {
    const core = new TestCore({
      clientId: CLIENT_ID,
      api: {
        insightsBaseUrl: 'https://ingest.example.test/',
        experienceBaseUrl: 'https://experience.example.test/',
      },
    })

    expect(Reflect.get(core.api.insights, 'baseUrl')).toBe('https://ingest.example.test/')
    expect(Reflect.get(core.api.experience, 'baseUrl')).toBe('https://experience.example.test/')
  })

  it('falls back to default base URLs when only one side is configured', () => {
    const core = new TestCore({
      clientId: CLIENT_ID,
      api: { insightsBaseUrl: 'https://ingest.example.test/' },
    })

    expect(Reflect.get(core.api.insights, 'baseUrl')).toBe('https://ingest.example.test/')
    expect(Reflect.get(core.api.experience, 'baseUrl')).toBe(EXPERIENCE_BASE_URL)
  })

  it('forwards top-level fetch options to the shared api config', () => {
    const fetchOptions = { requestTimeout: 9_000 }
    const core = new TestCore({
      clientId: CLIENT_ID,
      fetchOptions,
    })

    expect(core.api.config.fetchOptions).toEqual(fetchOptions)
  })

  it('exposes flagsResolver for advanced custom-flag resolution use cases', () => {
    const core = new TestCore(config)

    expect(core.flagsResolver).toBe(FlagsResolver)
  })

  it('resolves custom flags by key without auto-tracking in non-stateful environments', () => {
    const core = new TestCore(config)
    const trackFlagView = rs.spyOn(core, 'trackFlagView').mockResolvedValue(undefined)

    expect(core.getFlag('dark-mode', CHANGES)).toBe(true)
    expect(core.getFlag('price', CHANGES)).toEqual({
      amount: 10,
      currency: 'USD',
    })
    expect(trackFlagView).not.toHaveBeenCalled()
  })

  it('routes sticky component views through both Experience and Insights paths', async () => {
    const core = new TestCore(config)
    const profile = { id: 'profile-1' }

    await core.trackView({
      componentId: 'hero',
      sticky: true,
      viewId: 'hero-view',
      viewDurationMs: 1000,
      profile,
    })

    expect(core.lastExperienceCall).toEqual(
      expect.objectContaining({
        method: 'trackView',
        profile,
        event: expect.objectContaining({ type: 'component' }),
      }),
    )
    expect(core.lastInsightsCall).toEqual(
      expect.objectContaining({
        method: 'trackView',
        profile,
        event: expect.objectContaining({ type: 'component' }),
      }),
    )
  })

  it('routes non-sticky component views only through Insights', async () => {
    const core = new TestCore(config)

    await core.trackView({
      componentId: 'hero',
      viewId: 'hero-view',
      viewDurationMs: 1000,
    })

    expect(core.lastExperienceCall).toBeUndefined()
    expect(core.lastInsightsCall).toEqual(
      expect.objectContaining({
        method: 'trackView',
        event: expect.objectContaining({ type: 'component' }),
      }),
    )
  })
})
