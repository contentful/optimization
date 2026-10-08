import { profile } from '@contentful/optimization-core/test/fixtures/profile'
import ContentfulOptimization from '@contentful/optimization-web'
import type { OptimizationData } from '@contentful/optimization-web/api-schemas'
import { EventBuilder } from '@contentful/optimization-web/core-sdk'
import type { ContentOptimizationHandoff } from '@contentful/optimization-web/handoff'
import { rs } from '@rstest/core'
import { act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { OptimizationRoot } from '../root/OptimizationRoot'
import { ReactRouterAutoPageTracker } from './react-router'
import { TanStackRouterAutoPageTracker } from './tanstack-router'

const location = {
  pathname: '/products',
  search: '?tab=featured',
  searchStr: '?tab=featured',
  hash: '#hero',
  href: '/products?tab=featured#hero',
}

rs.mock('react-router-dom', () => ({
  useLocation: () => location,
  useMatches: () => [],
}))

rs.mock('@tanstack/react-router', () => ({
  useRouter: () => ({}),
  useRouterState: ({
    select,
  }: {
    select: (state: { location: typeof location; matches: unknown[] }) => unknown
  }) => select({ location, matches: [] }),
}))

afterEach(() => {
  rs.restoreAllMocks()
})

it.each([
  ['React Router static handoff', ReactRouterAutoPageTracker, false],
  ['React Router mismatched replay', ReactRouterAutoPageTracker, true],
  ['TanStack static handoff', TanStackRouterAutoPageTracker, false],
  ['TanStack mismatched replay', TanStackRouterAutoPageTracker, true],
] as const)('%s uses the tracker payload for the ordinary page', async (_name, Tracker, replay) => {
  Object.assign(location, {
    pathname: '/products',
    search: '?tab=featured',
    searchStr: '?tab=featured',
    hash: '',
    href: '/products?tab=featured',
  })
  const builder = new EventBuilder({
    channel: 'server',
    library: { name: 'server', version: '1.0.0' },
    getConsent: () => true,
  })
  const handoff: ContentOptimizationHandoff = {
    cache: { scope: replay ? 'private-request' : 'static' },
    hydration: 'preserve-server',
    ...(replay ? { replay: { routeKey: '/old', events: [builder.buildPageView()] } } : {}),
  }
  const delivery = rs.fn<ContentfulOptimization['api']['experience']['upsertProfile']>(
    async () => await Promise.resolve({ profile, changes: [], selectedOptimizations: [] }),
  )
  const getPagePayload = rs.fn(() => ({ properties: { source: 'browser' } }))
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  try {
    await act(async () => {
      await Promise.resolve()
      root.render(
        <StrictMode>
          <OptimizationRoot
            spaceId="test-space-id"
            defaults={{ consent: true, persistenceConsent: false }}
            handoff={handoff}
            routeKey="/products?tab=featured"
            onStatesReady={() => {
              const sdk = window.contentfulOptimization
              if (!(sdk instanceof ContentfulOptimization))
                throw new Error('Expected the owned SDK.')
              rs.spyOn(sdk.api.experience, 'upsertProfile').mockImplementation(delivery)
            }}
          >
            <Tracker
              handoff={handoff}
              pagePayload={{ properties: { section: 'catalogue' } }}
              getPagePayload={getPagePayload}
            />
          </OptimizationRoot>
        </StrictMode>,
      )
    })
    expect(delivery).toHaveBeenCalledTimes(1)
    expect(getPagePayload).toHaveBeenCalledTimes(1)
    expect(delivery.mock.calls[0]?.[0].events).toEqual([
      expect.objectContaining({
        type: 'page',
        properties: expect.objectContaining({
          path: '/products',
          source: 'browser',
          section: 'catalogue',
        }),
      }),
    ])
  } finally {
    act(() => {
      root.unmount()
    })
    container.remove()
  }
})

it.each([
  ['React Router without hash', ReactRouterAutoPageTracker, ''],
  ['React Router with hash', ReactRouterAutoPageTracker, '#hero'],
  ['TanStack without hash', TanStackRouterAutoPageTracker, ''],
  ['TanStack with hash', TanStackRouterAutoPageTracker, '#hero'],
] as const)(
  '%s shares paired startup with the root and tracks subsequent navigation',
  async (_name, Tracker, hash) => {
    Object.assign(location, {
      pathname: '/products',
      search: '?tab=featured',
      searchStr: '?tab=featured',
      hash,
      href: `/products?tab=featured${hash}`,
    })
    const builder = new EventBuilder({
      channel: 'server',
      library: { name: 'server', version: '1.0.0' },
      getConsent: () => true,
    })
    const data: OptimizationData = {
      profile: { ...profile, id: 'api-issued-id' },
      changes: [],
      selectedOptimizations: [],
    }
    let handoff: ContentOptimizationHandoff = {
      cache: { scope: 'private-request' },
      hydration: 'preserve-server',
      state: data,
      profileId: data.profile.id,
      replay: {
        routeKey: '/products?tab=featured',
        events: [builder.buildIdentify({ userId: 'customer' }), builder.buildPageView()],
      },
    }
    const firstDelivery = Promise.withResolvers<OptimizationData>()
    const delivery = rs.fn<ContentfulOptimization['api']['experience']['upsertProfile']>(
      async () => await firstDelivery.promise,
    )
    const getPagePayload = rs.fn(() => ({ properties: { source: 'browser' } }))
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    async function render(): Promise<void> {
      await act(async () => {
        await Promise.resolve()
        root.render(
          <StrictMode>
            <OptimizationRoot
              spaceId="test-space-id"
              allowedEventTypes={[]}
              defaults={{ consent: false, persistenceConsent: false }}
              handoff={handoff}
              routeKey={`${location.pathname}${location.search}`}
              onStatesReady={() => {
                const sdk = window.contentfulOptimization
                if (!(sdk instanceof ContentfulOptimization))
                  throw new Error('Expected the owned SDK.')
                rs.spyOn(sdk.api.experience, 'upsertProfile').mockImplementation(delivery)
              }}
            >
              <Tracker handoff={handoff} getPagePayload={getPagePayload} />
            </OptimizationRoot>
          </StrictMode>,
        )
      })
    }

    try {
      await render()
      expect(delivery).not.toHaveBeenCalled()
      await act(async () => {
        await Promise.resolve()
        window.contentfulOptimization?.consent(true)
      })
      expect(delivery).toHaveBeenCalledTimes(1)
      expect(delivery).toHaveBeenCalledWith(
        { profileId: data.profile.id, events: handoff.replay?.events },
        expect.objectContaining({ preflight: false }),
      )
      expect(getPagePayload).not.toHaveBeenCalled()
      handoff = { ...handoff }
      await render()
      expect(delivery).toHaveBeenCalledTimes(1)

      delivery.mockResolvedValue(data)
      Object.assign(location, {
        pathname: '/next',
        search: '?tab=new',
        searchStr: '?tab=new',
        hash: '#details',
        href: '/next?tab=new#details',
      })
      await render()
      expect(delivery).toHaveBeenCalledTimes(2)
      expect(delivery).toHaveBeenLastCalledWith({
        profileId: data.profile.id,
        events: [
          expect.objectContaining({
            type: 'page',
            properties: expect.objectContaining({
              path: '/next',
              search: '?tab=new',
              hash: '#details',
              source: 'browser',
            }),
          }),
        ],
      })
      expect(getPagePayload).toHaveBeenCalledTimes(1)

      Object.assign(location, {
        pathname: '/products',
        search: '?tab=featured',
        searchStr: '?tab=featured',
        hash,
        href: `/products?tab=featured${hash}`,
      })
      await render()
      expect(delivery).toHaveBeenCalledTimes(3)
      const returnEvents = delivery.mock.calls[2]?.[0].events
      expect(returnEvents).toEqual([
        expect.objectContaining({
          type: 'page',
          properties: expect.objectContaining({ path: '/products', source: 'browser' }),
        }),
      ])
      expect(returnEvents?.[0]?.messageId).not.toBe(handoff.replay?.events.at(-1)?.messageId)
      expect(getPagePayload).toHaveBeenCalledTimes(2)
      await render()
      expect(delivery).toHaveBeenCalledTimes(3)

      await act(async () => {
        firstDelivery.resolve(data)
        await firstDelivery.promise
      })
      handoff = {
        ...handoff,
        replay: {
          routeKey: '/products?tab=featured',
          events: [builder.buildTrack({ event: 'new-preparation' }), builder.buildPageView()],
        },
      }
      await render()
      expect(delivery).toHaveBeenCalledTimes(4)
      expect(delivery).toHaveBeenLastCalledWith(
        { profileId: data.profile.id, events: handoff.replay?.events },
        expect.objectContaining({ preflight: false }),
      )
    } finally {
      act(() => {
        root.unmount()
      })
      container.remove()
    }
  },
)
