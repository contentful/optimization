import type {
  OptimizationData,
  SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import type { OptimizationSelectionState } from '../handoff'

export const BASELINE: SelectedOptimizationArray = [
  {
    experienceId: '6IueRX1pS3iMJncbhUQTba',
    variantIndex: 1,
    variants: { '4ib0hsHWoSOnCVdDkizE8d': '4k6ZyFQnR2POY5IJLLlJRb' },
    sticky: false,
  },
  {
    experienceId: '5jT8mNPxQ2rVuY4wZaB6Cd',
    variantIndex: 2,
    variants: { '4k6ZyFQnR2POY5IJLLlJRb': '2qVK4T5lnScbswoyBuGipd' },
    sticky: false,
  },
  { experienceId: '7LcA9DeF2GhI4JkL6MnOpQ', variantIndex: 0, variants: {}, sticky: false },
]

export function makeOptimizationData(so: SelectedOptimizationArray): OptimizationData {
  return {
    profile: {
      id: 'f0837d7dc6344c36a3a0a06c4cde754b',
      stableId: 'f0837d7dc6344c36a3a0a06c4cde754b',
      random: 0.5,
      audiences: [],
      traits: {},
      location: {},
      session: {
        id: 'e77eab64-93ca-4f6e-8492-037c1ff67caa',
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
  data: Readonly<OptimizationSelectionState>,
) => OptimizationSelectionState | Promise<OptimizationSelectionState>
