import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core'
import React, { act, type ReactElement } from 'react'
import type ContentfulOptimization from '../ContentfulOptimization'
import { loadTestRenderer } from '../test/testRenderer'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const createOptimization = rs.fn()

rs.mock('../ContentfulOptimization', () => ({
  default: {
    create: createOptimization,
  },
}))

rs.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: rs.fn(),
    multiGet: rs.fn().mockResolvedValue([]),
    removeItem: rs.fn(),
    setItem: rs.fn(),
  },
}))

interface TestRenderer {
  unmount: () => void
  update: (element: ReactElement) => void
}

type EventStream = ContentfulOptimization['states']['eventStream']
type TestSdk = Pick<ContentfulOptimization, 'destroy' | 'setLocale'> & {
  states: Pick<ContentfulOptimization['states'], 'eventStream'>
}

function createEventStream(): EventStream {
  return {
    current: undefined,
    subscribe() {
      return { unsubscribe: () => undefined }
    },
    subscribeOnce() {
      return { unsubscribe: () => undefined }
    },
  }
}

function createSdk(): TestSdk {
  return {
    destroy: rs.fn(),
    setLocale: rs.fn(() => undefined),
    states: {
      eventStream: createEventStream(),
    },
  }
}

function requireRenderer(value: TestRenderer | undefined): TestRenderer {
  if (!value) {
    throw new Error('Expected renderer to be created')
  }

  return value
}

async function renderWithAct(element: ReactElement): Promise<TestRenderer> {
  const testRenderer = await loadTestRenderer<TestRenderer>()
  let nextRenderer: TestRenderer | undefined = undefined

  await act(async () => {
    nextRenderer = testRenderer.create(element)
    await Promise.resolve()
    await Promise.resolve()
  })

  return requireRenderer(nextRenderer)
}

describe('OptimizationProvider locale prop', () => {
  let renderer: TestRenderer | undefined = undefined

  void beforeEach(() => {
    renderer = undefined
    createOptimization.mockReset()
  })

  void afterEach(async () => {
    if (renderer) {
      await act(async () => {
        renderer?.unmount()
        await Promise.resolve()
      })
    }

    rs.restoreAllMocks()
  })

  it('updates the owned SDK when the locale prop changes', async () => {
    const { OptimizationProvider } = await import('./OptimizationProvider')
    const sdk = createSdk()
    createOptimization.mockResolvedValue(sdk)

    renderer = await renderWithAct(
      <OptimizationProvider clientId="test-client-id" locale="en-US">
        <></>
      </OptimizationProvider>,
    )

    expect(sdk.setLocale).toHaveBeenCalledWith('en-US')

    await act(async () => {
      requireRenderer(renderer).update(
        <OptimizationProvider clientId="test-client-id" locale="de-DE">
          <></>
        </OptimizationProvider>,
      )
      await Promise.resolve()
    })

    expect(sdk.setLocale).toHaveBeenCalledWith('de-DE')
  })
})
