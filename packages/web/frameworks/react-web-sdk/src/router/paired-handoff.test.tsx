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
    const handoff: ContentOptimizationHandoff = {
      cache: { scope: 'private-request' },
      hydration: 'preserve-server',
      state: data,
      profileId: data.profile.id,
      replay: {
        routeKey: '/products?tab=featured',
        events: [builder.buildIdentify({ userId: 'customer' }), builder.buildPageView()],
      },
    }
    const delivery = rs.fn(async () => await new Promise<OptimizationData>(() => undefined))
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
              <Tracker handoff={handoff} getPagePayload={getPagePayload} />
            </OptimizationRoot>
          </StrictMode>,
        )
      })
    }

    try {
      await render()
      expect(delivery).toHaveBeenCalledTimes(1)
      expect(delivery).toHaveBeenCalledWith(
        { profileId: data.profile.id, events: handoff.replay?.events },
        expect.objectContaining({ preflight: false }),
      )
      expect(getPagePayload).not.toHaveBeenCalled()
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
    } finally {
      act(() => {
        root.unmount()
      })
      container.remove()
    }
  },
)
