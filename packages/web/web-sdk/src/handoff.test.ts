import { batch, signals } from '@contentful/optimization-core'
import type {
  ChangeArray,
  Profile,
  SelectedOptimizationArray,
} from '@contentful/optimization-core/api-schemas'
import ContentfulOptimization from './ContentfulOptimization'
import { hydrateOptimizationHandoff, type ContentOptimizationHandoff } from './handoff'

const config = {
  clientId: 'key_123',
  environment: 'main',
}

const createProfile = (id: string): Profile => ({
  id,
  stableId: id,
  random: 1,
  audiences: [],
  traits: {},
  location: {},
  session: {
    id: `${id}-session`,
    isReturningVisitor: false,
    landingPage: {
      path: '/',
      query: {},
      referrer: '',
      search: '',
      title: '',
      url: 'https://example.test/',
    },
    count: 1,
    activeSessionLength: 0,
    averageSessionLength: 0,
  },
})

const selectedOptimizations: SelectedOptimizationArray = [
  {
    experienceId: 'experience-id',
    sticky: false,
    variantIndex: 1,
    variants: { baseline: 'variant' },
  },
]

const changes: ChangeArray = [
  {
    key: 'flag',
    type: 'Variable',
    value: true,
    meta: {
      experienceId: 'experience-id',
      variantIndex: 1,
    },
  },
]

function createContentHandoff(
  state: ContentOptimizationHandoff['state'],
): ContentOptimizationHandoff {
  return {
    cache: { scope: 'static' },
    hydration: 'preserve-server',
    initialPageEvent: 'skip',
    state,
  }
}

function resetSignals(): void {
  batch(() => {
    signals.blockedEvent.value = undefined
    signals.changes.value = undefined
    signals.consent.value = undefined
    signals.event.value = undefined
    signals.experienceRequestState.value = { status: 'idle' }
    signals.locale.value = undefined
    signals.online.value = true
    signals.persistenceConsent.value = undefined
    signals.previewPanelAttached.value = false
    signals.previewPanelOpen.value = false
    signals.profile.value = undefined
    signals.selectedOptimizations.value = undefined
  })
}

describe('hydrateOptimizationHandoff', () => {
  beforeEach(() => {
    delete window.contentfulOptimization
    localStorage.clear()
    resetSignals()
  })

  afterEach(() => {
    window.contentfulOptimization?.destroy()
    delete window.contentfulOptimization
    rs.restoreAllMocks()
  })

  it('hydrates selection state without clearing existing profile continuity', async () => {
    const existingProfile = createProfile('existing-profile')
    const sdk = new ContentfulOptimization({
      ...config,
      defaults: {
        consent: true,
        persistenceConsent: true,
        profile: existingProfile,
      },
    })

    await hydrateOptimizationHandoff(
      sdk,
      createContentHandoff({
        changes,
        selectedOptimizations,
      }),
    )

    expect(signals.changes.value).toEqual(changes)
    expect(sdk.states.selectedOptimizations.current).toEqual(selectedOptimizations)
    expect(sdk.states.profile.current).toEqual(existingProfile)
    expect(sdk.states.experienceRequestState.current).toEqual({ status: 'success' })
  })

  it('applies a full server profile when the handoff includes one', async () => {
    const existingProfile = createProfile('existing-profile')
    const serverProfile = createProfile('server-profile')
    const sdk = new ContentfulOptimization({
      ...config,
      defaults: {
        consent: true,
        persistenceConsent: true,
        profile: existingProfile,
      },
    })

    await hydrateOptimizationHandoff(
      sdk,
      createContentHandoff({
        changes,
        profile: serverProfile,
        selectedOptimizations,
      }),
    )

    expect(sdk.states.profile.current).toEqual(serverProfile)
    expect(sdk.states.selectedOptimizations.current).toEqual(selectedOptimizations)
  })

  it('rejects analytics-only handoffs', async () => {
    const sdk = new ContentfulOptimization(config)

    await expect(
      Reflect.apply(hydrateOptimizationHandoff, undefined, [
        sdk,
        {
          cache: { scope: 'static' },
          hydration: 'analytics-only',
          initialPageEvent: 'skip',
        },
      ]),
    ).rejects.toThrow('content optimization handoffs')
  })
})
