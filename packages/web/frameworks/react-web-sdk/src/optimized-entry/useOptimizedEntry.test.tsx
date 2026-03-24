import type { SelectedPersonalizationArray } from '@contentful/optimization-web/api-schemas'
import type { LiveUpdatesContextValue } from '../context/LiveUpdatesContext'
import type { OptimizationSdk } from '../context/OptimizationContext'
import {
  createRuntime,
  defaultLiveUpdatesContext,
  createTestEntry as makeEntry,
  createPersonalizableTestEntry as makePersonalizableEntry,
  renderWithOptimizationProviders,
} from '../test/sdkTestUtils'
import { useOptimizedEntry, type UseOptimizedEntryResult } from './useOptimizedEntry'

async function renderHook(params: {
  baselineEntry: ReturnType<typeof makeEntry>
  liveUpdates?: boolean
  optimization: OptimizationSdk
  liveUpdatesContext?: LiveUpdatesContextValue
}): Promise<{ getResult: () => UseOptimizedEntryResult; unmount: () => Promise<void> }> {
  const {
    baselineEntry,
    liveUpdates,
    optimization,
    liveUpdatesContext = defaultLiveUpdatesContext(),
  } = params
  let captured: UseOptimizedEntryResult | undefined = undefined

  function Probe(): null {
    captured = useOptimizedEntry({ baselineEntry, liveUpdates })
    return null
  }

  const view = await renderWithOptimizationProviders(<Probe />, optimization, liveUpdatesContext)

  return {
    getResult() {
      if (!captured) {
        throw new Error('Expected hook result to be captured')
      }

      return captured
    },
    async unmount() {
      await view.unmount()
    },
  }
}

describe('useOptimizedEntry', () => {
  it('returns baseline state before personalization is available', async () => {
    const baselineEntry = makePersonalizableEntry('baseline')
    const { optimization } = createRuntime((entry) => ({ entry }))
    const rendered = await renderHook({ baselineEntry, optimization })

    expect(rendered.getResult()).toMatchObject({
      entry: baselineEntry,
      personalization: undefined,
      isLoading: true,
      isReady: true,
      canPersonalize: false,
      selectedPersonalizations: undefined,
    })

    await rendered.unmount()
  })

  it('returns resolved variant data once personalizations are available', async () => {
    const baselineEntry = makePersonalizableEntry('baseline')
    const variantEntry = makeEntry('variant-a')
    const variantState: SelectedPersonalizationArray = [
      {
        experienceId: 'exp-hero',
        sticky: true,
        variantIndex: 1,
        variants: { baseline: 'variant-a' },
      },
    ]
    const { emit, optimization } = createRuntime((entry, personalizations) => ({
      entry: personalizations ? variantEntry : entry,
      personalization: personalizations?.[0],
    }))
    const rendered = await renderHook({ baselineEntry, optimization })

    await emit(variantState)

    expect(rendered.getResult()).toMatchObject({
      entry: variantEntry,
      personalization: variantState[0],
      isLoading: false,
      canPersonalize: true,
      selectedPersonalizations: variantState,
    })

    await rendered.unmount()
  })

  it('locks on the first personalization when live updates are disabled', async () => {
    const baselineEntry = makePersonalizableEntry('baseline')
    const variantOne = makeEntry('variant-a')
    const variantTwo = makeEntry('variant-b')
    const variantOneState: SelectedPersonalizationArray = [
      {
        experienceId: 'exp-hero',
        sticky: true,
        variantIndex: 1,
        variants: { baseline: 'variant-a' },
      },
    ]
    const variantTwoState: SelectedPersonalizationArray = [
      {
        experienceId: 'exp-hero',
        sticky: false,
        variantIndex: 2,
        variants: { baseline: 'variant-b' },
      },
    ]
    const { emit, optimization } = createRuntime((entry, personalizations) => ({
      entry:
        personalizations?.[0]?.variantIndex === 1
          ? variantOne
          : personalizations?.[0]?.variantIndex === 2
            ? variantTwo
            : entry,
      personalization: personalizations?.[0],
    }))
    const rendered = await renderHook({ baselineEntry, optimization })

    await emit(variantOneState)
    expect(rendered.getResult().entry).toEqual(variantOne)

    await emit(variantTwoState)
    expect(rendered.getResult().entry).toEqual(variantOne)
    expect(rendered.getResult().selectedPersonalizations).toEqual(variantOneState)

    await rendered.unmount()
  })

  it('follows personalization changes when live updates are enabled', async () => {
    const baselineEntry = makePersonalizableEntry('baseline')
    const variantOne = makeEntry('variant-a')
    const variantTwo = makeEntry('variant-b')
    const variantOneState: SelectedPersonalizationArray = [
      {
        experienceId: 'exp-hero',
        sticky: true,
        variantIndex: 1,
        variants: { baseline: 'variant-a' },
      },
    ]
    const variantTwoState: SelectedPersonalizationArray = [
      {
        experienceId: 'exp-hero',
        sticky: false,
        variantIndex: 2,
        variants: { baseline: 'variant-b' },
      },
    ]
    const { emit, optimization } = createRuntime((entry, personalizations) => ({
      entry:
        personalizations?.[0]?.variantIndex === 1
          ? variantOne
          : personalizations?.[0]?.variantIndex === 2
            ? variantTwo
            : entry,
      personalization: personalizations?.[0],
    }))
    const rendered = await renderHook({ baselineEntry, optimization, liveUpdates: true })

    await emit(variantOneState)
    expect(rendered.getResult().entry).toEqual(variantOne)

    await emit(variantTwoState)
    expect(rendered.getResult().entry).toEqual(variantTwo)
    expect(rendered.getResult().selectedPersonalizations).toEqual(variantTwoState)

    await rendered.unmount()
  })

  it('treats non-personalized entries as ready immediately', async () => {
    const baselineEntry = makeEntry('baseline')
    const { optimization } = createRuntime((entry) => ({ entry }))
    const rendered = await renderHook({ baselineEntry, optimization })

    expect(rendered.getResult()).toMatchObject({
      entry: baselineEntry,
      isLoading: false,
      isReady: true,
      canPersonalize: false,
      personalization: undefined,
      selectedPersonalizations: undefined,
    })

    await rendered.unmount()
  })
})
