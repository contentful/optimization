import ContentfulOptimization from '@contentful/optimization-web'
import type { OptimizationData } from '@contentful/optimization-web/api-schemas'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import * as client from './client'
import { NextjsOptimizationState, OptimizationContext } from './client'

type RemovedHydratorPrefix = 'Nextjs'
type RemovedHydratorSuffixPrefix = 'ServerOptimization'
type RemovedHydratorSuffixSuffix = 'Hydrator'
type RemovedHydratorSuffix = `${RemovedHydratorSuffixPrefix}${RemovedHydratorSuffixSuffix}`
type RemovedHydratorExportName = `${RemovedHydratorPrefix}${RemovedHydratorSuffix}`
type RemovedHydratorExportIsAbsent = RemovedHydratorExportName extends keyof typeof client
  ? false
  : true

const removedHydratorExportIsAbsent: RemovedHydratorExportIsAbsent = true
const removedHydratorExportName = ['Nextjs', 'ServerOptimization', 'Hydrator'].join('')

const testConfig = {
  clientId: 'test-client-id',
  environment: 'main',
  api: {
    insightsBaseUrl: 'http://localhost:8000/insights/',
    experienceBaseUrl: 'http://localhost:8000/experience/',
  },
}

function cleanupOptimizationSingleton(): void {
  window.contentfulOptimization?.destroy()
  document.body.innerHTML = ''
}

void afterEach(() => {
  cleanupOptimizationSingleton()
})

const optimizationData: OptimizationData = {
  changes: [],
  selectedOptimizations: [],
  profile: {
    id: 'server-profile-id',
    stableId: 'server-profile-id',
    random: 0.5,
    audiences: [],
    traits: {},
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
        url: 'http://localhost/',
      },
      count: 1,
      activeSessionLength: 0,
      averageSessionLength: 0,
    },
  },
}

async function renderClientStateMarker(
  sdk: ContentfulOptimization,
  data: OptimizationData | undefined,
): Promise<{ unmount: () => void }> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <OptimizationContext.Provider value={{ sdk, isReady: true, error: undefined }}>
        <NextjsOptimizationState data={data} />
      </OptimizationContext.Provider>,
    )
    await Promise.resolve()
    await Promise.resolve()
  })

  return {
    unmount() {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

describe('Next.js client optimization state marker', () => {
  it('exports NextjsOptimizationState without the removed server hydrator API', () => {
    expect(removedHydratorExportIsAbsent).toBe(true)
    expect(client.NextjsOptimizationState).toBeTypeOf('function')
    expect(removedHydratorExportName in client).toBe(false)
  })

  it('renders no UI', () => {
    const sdk = new ContentfulOptimization(testConfig)

    const markup = renderToString(
      <OptimizationContext.Provider value={{ sdk, isReady: true, error: undefined }}>
        <NextjsOptimizationState data={optimizationData} />
      </OptimizationContext.Provider>,
    )

    expect(markup).toBe('')
    sdk.destroy()
  })

  it('hands server optimization state to the nearest optimization provider runtime', async () => {
    const sdk = new ContentfulOptimization(testConfig)

    const rendered = await renderClientStateMarker(sdk, optimizationData)

    expect(sdk.states.profile.current).toEqual(optimizationData.profile)
    expect(sdk.states.selectedOptimizations.current).toEqual(optimizationData.selectedOptimizations)
    expect(sdk.states.experienceRequestState.current).toEqual({ status: 'success' })

    rendered.unmount()
    sdk.destroy()
  })

  it('does not change optimization state when data is undefined', async () => {
    const sdk = new ContentfulOptimization(testConfig)

    const rendered = await renderClientStateMarker(sdk, undefined)

    expect(sdk.states.profile.current).toBeUndefined()
    expect(sdk.states.selectedOptimizations.current).toBeUndefined()

    rendered.unmount()
    sdk.destroy()
  })
})
