import * as client from './client'

type RemovedHydratorPrefix = 'Nextjs'
type RemovedHydratorSuffixPrefix = 'ServerOptimization'
type RemovedHydratorSuffixSuffix = 'Hydrator'
type RemovedHydratorSuffix = `${RemovedHydratorSuffixPrefix}${RemovedHydratorSuffixSuffix}`
type RemovedHydratorExportName = `${RemovedHydratorPrefix}${RemovedHydratorSuffix}`
type RemovedHydratorExportIsAbsent = RemovedHydratorExportName extends keyof typeof client
  ? false
  : true

type RemovedStateMarkerExportName = 'NextjsOptimizationState'
type RemovedStateMarkerExportIsAbsent = RemovedStateMarkerExportName extends keyof typeof client
  ? false
  : true

const removedHydratorExportIsAbsent: RemovedHydratorExportIsAbsent = true
const removedStateMarkerExportIsAbsent: RemovedStateMarkerExportIsAbsent = true
const removedHydratorExportName = ['Nextjs', 'ServerOptimization', 'Hydrator'].join('')
const removedStateMarkerExportName = ['Nextjs', 'Optimization', 'State'].join('')

describe('Next.js client subpath', () => {
  it('no longer exports the removed server hydrator or state marker APIs', () => {
    expect(removedHydratorExportIsAbsent).toBe(true)
    expect(removedStateMarkerExportIsAbsent).toBe(true)
    expect(removedHydratorExportName in client).toBe(false)
    expect(removedStateMarkerExportName in client).toBe(false)
  })

  it('re-exports the live client surface for provider handoff', () => {
    expect(client.OptimizationRoot).toBeTypeOf('function')
    expect(client.OptimizationProvider).toBeTypeOf('function')
    expect(client.NextAppAutoPageTracker).toBeTypeOf('function')
    expect(client.NextPagesAutoPageTracker).toBeTypeOf('function')
  })
})
