import { profile } from '@contentful/optimization-core/test/fixtures/profile'
import ContentfulOptimization from '@contentful/optimization-web'
import { EventBuilder } from '@contentful/optimization-web/core-sdk'
import type { ContentOptimizationHandoff } from '@contentful/optimization-web/handoff'
import { afterEach, expect, it, rs } from '@rstest/core'
import { act, useEffect, useState, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { useBeforeInitialPageReady } from '../context/BeforeInitialPageContext'
import { useOptimizationContext } from '../hooks/useOptimization'
import { OptimizationRoot } from './OptimizationRoot'

afterEach(() => {
  rs.useRealTimers()
  rs.restoreAllMocks()
})

it.each([
  { name: 'paired replay to browser page to paired replay', paired: [true, false, true] },
  { name: 'browser page to paired replay to browser page', paired: [false, true, false] },
])('preserves the owned root across $name', async ({ paired }) => {
  const data = { profile, changes: [], selectedOptimizations: [] }
  const delivery = rs.fn<ContentfulOptimization['api']['experience']['upsertProfile']>(
    async () => await Promise.resolve(data),
  )
  const beforeInitialPage = { run: rs.fn(() => undefined) }
  const onMount = rs.fn()
  const onUnmount = rs.fn()
  const destroy = rs.spyOn(ContentfulOptimization.prototype, 'destroy')
  const liveSdks = new Set<ContentfulOptimization>()
  const builder = new EventBuilder({
    channel: 'server',
    library: { name: 'server', version: '1.0.0' },
    getConsent: () => true,
  })
  const routes = ['/page-two', '/static', '/paired-return']
  const initialUrl = window.location.href
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  function StatefulChild(): ReactElement {
    const { isLive, sdk } = useOptimizationContext()
    const [count, setCount] = useState(0)
    if (isLive && sdk instanceof ContentfulOptimization) liveSdks.add(sdk)

    useEffect(() => {
      onMount()
      return () => {
        onUnmount()
      }
    }, [])

    return (
      <button
        onClick={() => {
          setCount((previous) => previous + 1)
        }}
      >
        {count}
      </button>
    )
  }

  async function render(routeKey: string, handoff?: ContentOptimizationHandoff): Promise<void> {
    window.history.replaceState(null, '', routeKey)
    await act(async () => {
      root.render(
        <OptimizationRoot
          spaceId="test-space-id"
          allowedEventTypes={[]}
          defaults={{ consent: true, persistenceConsent: false }}
          handoff={handoff}
          routeKey={routeKey}
          buildPagePayload={() => ({ properties: { route: routeKey } })}
          beforeInitialPage={beforeInitialPage}
          onStatesReady={() => {
            const sdk = window.contentfulOptimization
            if (!(sdk instanceof ContentfulOptimization)) throw new Error('Expected the owned SDK.')
            rs.spyOn(sdk.api.experience, 'upsertProfile').mockImplementation(delivery)
          }}
        >
          <StatefulChild />
        </OptimizationRoot>,
      )
      await Promise.resolve()
    })
  }

  try {
    for (const [index, routeKey] of routes.entries()) {
      const handoff: ContentOptimizationHandoff | undefined = paired[index]
        ? {
            cache: { scope: 'private-request' },
            hydration: 'preserve-server',
            state: data,
            profileId: profile.id,
            replay: {
              routeKey,
              events: [builder.buildPageView({ properties: { route: routeKey } })],
            },
          }
        : undefined

      await render(routeKey, handoff)

      expect(liveSdks.size).toBe(1)
      expect(window.contentfulOptimization).toBe([...liveSdks][0])
      expect(destroy).not.toHaveBeenCalled()
      expect(onMount).toHaveBeenCalledTimes(1)
      expect(onUnmount).not.toHaveBeenCalled()
      expect(beforeInitialPage.run).toHaveBeenCalledTimes(paired[0] ? 0 : 1)
      const pages = delivery.mock.calls.flatMap(([request]) =>
        request.events.filter(({ type }) => type === 'page'),
      )
      expect(pages).toMatchObject(
        routes.slice(0, index + 1).map((route) => ({ type: 'page', properties: { route } })),
      )

      if (index === 0) {
        await act(async () => {
          container.querySelector('button')?.click()
          await Promise.resolve()
        })
      }
      expect(container.querySelector('button')?.textContent).toBe('1')

      await render(routeKey, handoff)
      expect(delivery.mock.calls.flatMap(([request]) => request.events)).toHaveLength(index + 1)
    }
  } finally {
    act(() => {
      root.unmount()
    })
    container.remove()
    window.history.replaceState(null, '', initialUrl)
  }

  expect(destroy).toHaveBeenCalledTimes(1)
  expect(onUnmount).toHaveBeenCalledTimes(1)
})

it.each(['resolves', 'rejects'] as const)(
  'admits a paired replay while the initial callback is pending and later %s',
  async (settlement) => {
    rs.useFakeTimers()
    const maxWaitMs = 25
    const callback = Promise.withResolvers<undefined>()
    const callbackFinished = rs.fn()
    const onError = rs.fn()
    const beforeInitialPage = {
      maxWaitMs,
      onError,
      run: rs.fn(async () => {
        try {
          await callback.promise
        } finally {
          callbackFinished()
        }
      }),
    }
    const data = { profile, changes: [], selectedOptimizations: [] }
    const delivery = rs.fn<ContentfulOptimization['api']['experience']['upsertProfile']>(
      async () => await Promise.resolve(data),
    )
    const destroy = rs.spyOn(ContentfulOptimization.prototype, 'destroy')
    const onMount = rs.fn()
    const onUnmount = rs.fn()
    const liveSdks = new Set<ContentfulOptimization>()
    const builder = new EventBuilder({
      channel: 'server',
      library: { name: 'server', version: '1.0.0' },
      getConsent: () => true,
    })
    const routeKey = '/paired-target'
    const handoff: ContentOptimizationHandoff = {
      cache: { scope: 'private-request' },
      hydration: 'preserve-server',
      state: data,
      profileId: profile.id,
      replay: {
        routeKey,
        events: [builder.buildPageView({ properties: { route: routeKey } })],
      },
    }
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    function StatefulChild(): ReactElement {
      const { isLive, sdk } = useOptimizationContext()
      const isReady = useBeforeInitialPageReady()
      const [count, setCount] = useState(0)
      if (isLive && sdk instanceof ContentfulOptimization) liveSdks.add(sdk)

      useEffect(() => {
        onMount()
        return () => {
          onUnmount()
        }
      }, [])

      return (
        <button
          data-ready={String(isReady)}
          onClick={() => {
            setCount((previous) => previous + 1)
          }}
        >
          {count}
        </button>
      )
    }

    async function render(currentHandoff?: ContentOptimizationHandoff): Promise<void> {
      const currentRoute = currentHandoff === undefined ? '/standalone' : routeKey
      await act(async () => {
        root.render(
          <OptimizationRoot
            spaceId="test-space-id"
            allowedEventTypes={[]}
            defaults={{ consent: true, persistenceConsent: false }}
            handoff={currentHandoff}
            routeKey={currentRoute}
            buildPagePayload={() => ({ properties: { route: currentRoute } })}
            beforeInitialPage={beforeInitialPage}
            onStatesReady={() => {
              const sdk = window.contentfulOptimization
              if (!(sdk instanceof ContentfulOptimization))
                throw new Error('Expected the owned SDK.')
              rs.spyOn(sdk.api.experience, 'upsertProfile').mockImplementation(delivery)
            }}
          >
            <StatefulChild />
          </OptimizationRoot>,
        )
        await Promise.resolve()
      })
    }

    try {
      await render()
      expect(beforeInitialPage.run).toHaveBeenCalledTimes(1)
      expect(delivery).not.toHaveBeenCalled()
      expect(container.querySelector('button')?.dataset.ready).toBe('false')
      const initialSdk = window.contentfulOptimization
      expect(initialSdk).toBeInstanceOf(ContentfulOptimization)
      await act(async () => {
        container.querySelector('button')?.click()
        await Promise.resolve()
      })

      await render(handoff)

      expect(callbackFinished).not.toHaveBeenCalled()
      expect(window.contentfulOptimization).toBe(initialSdk)
      expect(liveSdks.size).toBe(1)
      expect(destroy).not.toHaveBeenCalled()
      expect(onMount).toHaveBeenCalledTimes(1)
      expect(onUnmount).not.toHaveBeenCalled()
      expect(container.querySelector('button')?.textContent).toBe('1')
      expect(container.querySelector('button')?.dataset.ready).toBe('true')
      expect(delivery).toHaveBeenCalledTimes(1)
      expect(delivery.mock.calls[0]?.[0].events).toEqual(handoff.replay?.events)

      await act(async () => {
        await rs.advanceTimersByTimeAsync(maxWaitMs)
      })
      expect(onError).not.toHaveBeenCalled()
      expect(delivery).toHaveBeenCalledTimes(1)
      expect(callbackFinished).not.toHaveBeenCalled()

      await act(async () => {
        if (settlement === 'resolves') callback.resolve(undefined)
        else callback.reject(new Error('Late callback failure.'))
        await Promise.resolve()
      })
      await render(handoff)
      expect(callbackFinished).toHaveBeenCalledTimes(1)
      expect(beforeInitialPage.run).toHaveBeenCalledTimes(1)
      expect(delivery).toHaveBeenCalledTimes(1)
      expect(destroy).not.toHaveBeenCalled()
      expect(container.querySelector('button')?.dataset.ready).toBe('true')
    } finally {
      callback.resolve(undefined)
      act(() => {
        root.unmount()
      })
      container.remove()
    }

    expect(destroy).toHaveBeenCalledTimes(1)
    expect(onUnmount).toHaveBeenCalledTimes(1)
  },
)
