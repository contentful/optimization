import type {
  OptimizationData,
  SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'

export const BASELINE: SelectedOptimizationArray = [
  { experienceId: 'exp-1', variantIndex: 1, variants: { b1: 'v1' }, sticky: false },
  { experienceId: 'exp-2', variantIndex: 2, variants: { b2: 'v2' }, sticky: false },
  { experienceId: 'exp-3', variantIndex: 0, variants: {}, sticky: false },
]

export function makeOptimizationData(so: SelectedOptimizationArray): OptimizationData {
  return {
    profile: {
      id: 'p1',
      stableId: 'p1',
      random: 0.5,
      audiences: [],
      traits: {},
      location: {},
      session: {
        id: 's1',
        isReturningVisitor: false,
        count: 1,
        activeSessionLength: 0,
        averageSessionLength: 0,
        landingPage: {
          url: 'https://example.test/',
          referrer: '',
          query: {},
          search: '',
          path: '/',
          title: '',
        },
      },
    },
    selectedOptimizations: so,
    changes: [],
  }
}

export type InterceptorFn = (
  data: Readonly<OptimizationData>,
) => OptimizationData | Promise<OptimizationData>
