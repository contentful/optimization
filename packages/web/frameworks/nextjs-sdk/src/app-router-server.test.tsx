import type { MergeTagEntry } from '@contentful/optimization-node/api-schemas'
import { useOptimization } from '@contentful/optimization-react-web'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createNextjsAppRouterOptimization } from './app-router-server'
import {
  NEXTJS_OPTIMIZATION_SERVER_DATA_HEADER,
  serializeNextjsOptimizationRequestContext,
} from './request-context'
import type { OptimizationData, ServerTrackingBaselineEntry } from './server'

const sdkConfig = {
  clientId: 'test-client-id',
  environment: 'main',
  locale: 'en-US',
}

const baselineEntry = createEntry('baseline-entry')
const optimizationData: OptimizationData = {
  changes: [],
  selectedOptimizations: [],
  profile: {
    id: 'server-profile-id',
    stableId: 'server-profile-id',
    random: 0.5,
    audiences: [],
    traits: {
      continent: 'EU',
    },
    location: {},
    session: {
      id: 'server-session-id',
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
  },
}

let currentHeaders = new Headers()

rs.mock('next/headers', () => ({
  headers: () => currentHeaders,
}))

void afterEach(() => {
  currentHeaders = new Headers()
  rs.restoreAllMocks()
})

function setServerData(
  consent: boolean | { events?: boolean; persistence?: boolean },
  data: OptimizationData | undefined = optimizationData,
): void {
  currentHeaders = new Headers({
    [NEXTJS_OPTIMIZATION_SERVER_DATA_HEADER]: serializeNextjsOptimizationRequestContext({
      consent,
      data,
    }),
  })
}

function createEntry(id: string): ServerTrackingBaselineEntry {
  return {
    fields: {},
    metadata: {
      tags: [],
    },
    sys: {
      contentType: {
        sys: {
          id: 'content-type',
          linkType: 'ContentType',
          type: 'Link',
        },
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      environment: {
        sys: {
          id: 'main',
          linkType: 'Environment',
          type: 'Link',
        },
      },
      id,
      locale: 'en-US',
      publishedVersion: 1,
      revision: 1,
      space: {
        sys: {
          id: 'space-id',
          linkType: 'Space',
          type: 'Link',
        },
      },
      type: 'Entry',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  }
}

function createMergeTagEntry(id: string, selector: string): MergeTagEntry {
  const entry = createEntry(id)
  const mergeTagEntry: MergeTagEntry = {
    ...entry,
    fields: {
      nt_mergetag_id: selector,
      nt_name: selector,
    },
    sys: {
      ...entry.sys,
      contentType: {
        sys: {
          id: 'nt_mergetag',
          linkType: 'ContentType',
          type: 'Link',
        },
      },
    },
  }
  return mergeTagEntry
}

describe('Next.js App Router server components', () => {
  it('exposes only the App Router tracker and proxy from the factory', () => {
    const components = createNextjsAppRouterOptimization({
      ...sdkConfig,
      server: {
        enabled: false,
      },
    })

    expect(components.NextAppAutoPageTracker).toBeTypeOf('function')
    expect(components.proxy).toBeTypeOf('function')
    expect(components).not.toHaveProperty('config')
    expect(components).not.toHaveProperty('NextPagesAutoPageTracker')
  })

  it('loads server data into the bound client provider', async () => {
    setServerData({ events: true, persistence: true })

    const { OptimizationRoot } = createNextjsAppRouterOptimization({
      ...sdkConfig,
      defaults: { consent: false, persistenceConsent: false },
      server: {
        enabled: true,
        consent: { events: true, persistence: true },
      },
    })

    const element = await OptimizationRoot({ children: 'Server content' })

    expect(element).toMatchObject({
      props: {
        children: {
          props: {
            children: 'Server content',
          },
        },
        clientId: sdkConfig.clientId,
        defaults: { consent: true, persistenceConsent: true },
        environment: sdkConfig.environment,
        serverOptimizationState: optimizationData,
      },
    })
  })

  it('loads server defaults and live updates into the bound provider', async () => {
    setServerData({ events: true, persistence: false })
    const { OptimizationProvider } = createNextjsAppRouterOptimization({
      ...sdkConfig,
      defaults: { consent: false, persistenceConsent: true },
      liveUpdates: true,
      server: {
        enabled: true,
        consent: { events: true, persistence: false },
      },
    })

    const element = await OptimizationProvider({ children: 'Provider content' })

    expect(element).toMatchObject({
      props: {
        defaults: { consent: true, persistenceConsent: false },
        serverOptimizationState: optimizationData,
      },
    })
    expect(element).toMatchObject({
      props: {
        children: {
          props: {
            children: 'Provider content',
            globalLiveUpdates: true,
          },
        },
      },
    })
  })

  it('loads server data with false consent so the Node SDK can apply its allowlist', async () => {
    setServerData(false)
    const { OptimizationRoot } = createNextjsAppRouterOptimization({
      ...sdkConfig,
      defaults: { consent: true, persistenceConsent: true },
      server: {
        enabled: true,
        consent: false,
      },
    })

    const element = await OptimizationRoot({ children: 'Server content' })

    expect(element).toMatchObject({
      props: {
        children: {
          props: {
            children: 'Server content',
          },
        },
        defaults: { consent: false, persistenceConsent: false },
        serverOptimizationState: optimizationData,
      },
    })
  })

  it('renders Node-derived server state during server render', async () => {
    setServerData(true)
    const { OptimizationRoot } = createNextjsAppRouterOptimization({
      ...sdkConfig,
      server: {
        enabled: true,
        consent: true,
      },
    })

    function ProfileProbe(): ReactElement {
      const sdk = useOptimization()

      return <span>{sdk.states.profile.current?.id}</span>
    }

    const element = await OptimizationRoot({ children: <ProfileProbe /> })

    expect(renderToString(element)).toContain('server-profile-id')
  })

  it('renders baseline entry content when server rendering is disabled', async () => {
    const { OptimizedEntry } = createNextjsAppRouterOptimization({
      ...sdkConfig,
      server: {
        enabled: false,
      },
    })

    const element = await OptimizedEntry({
      baselineEntry,
      children: (entry) => entry.sys.id,
      'data-testid': 'entry',
      trackViews: true,
    })

    expect(element.props).toMatchObject({
      'data-ctfl-baseline-id': 'baseline-entry',
      'data-ctfl-entry-id': 'baseline-entry',
      'data-ctfl-track-views': true,
      'data-testid': 'entry',
      children: 'baseline-entry',
    })
  })

  it('passes request-profile merge-tag helpers to server render props', async () => {
    setServerData(true)
    const mergeTagEntry = createMergeTagEntry('merge-tag', 'traits.continent')
    const { OptimizedEntry } = createNextjsAppRouterOptimization({
      ...sdkConfig,
      server: {
        enabled: true,
        consent: true,
      },
    })

    const element = await OptimizedEntry({
      baselineEntry,
      children: (_entry, { getMergeTagValue }) => getMergeTagValue(mergeTagEntry) ?? 'missing',
    })

    expect(element.props).toMatchObject({ children: 'EU' })
  })

  it('throws when server rendering is enabled without forwarded proxy data', async () => {
    const { OptimizationRoot } = createNextjsAppRouterOptimization({
      ...sdkConfig,
      server: {
        enabled: true,
        consent: true,
      },
    })

    await expect(OptimizationRoot({ children: 'Server content' })).rejects.toThrow(
      'requires exporting its proxy from proxy.ts with a matching Next.js config',
    )
  })
})
