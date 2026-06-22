import type { ServerTrackingBaselineEntry, ServerTrackingResolvedData } from './tracking-attributes'
import { getServerTrackingAttributes } from './tracking-attributes'

const baselineEntry = createBaselineEntry()
const resolvedData = createResolvedData()

function createBaselineEntry(): ServerTrackingBaselineEntry {
  const entry = {
    sys: { id: 'baseline-entry' },
  }

  if (isServerTrackingBaselineEntry(entry)) {
    return entry
  }

  throw new Error('Expected test baseline entry to satisfy the tracking contract.')
}

function createResolvedData(): ServerTrackingResolvedData {
  const data = {
    entry: {
      sys: { id: 'variant-entry' },
    },
    selectedOptimization: {
      duplicationScope: 'profile',
      experienceId: 'experience-id',
      sticky: true,
      variantIndex: 2,
    },
  }

  if (isServerTrackingResolvedData(data)) {
    return data
  }

  throw new Error('Expected test resolved data to satisfy the tracking contract.')
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isServerTrackingBaselineEntry(value: unknown): value is ServerTrackingBaselineEntry {
  if (!isObjectRecord(value)) return false
  const { sys } = value

  return isObjectRecord(sys) && typeof sys.id === 'string'
}

function isServerTrackingResolvedData(value: unknown): value is ServerTrackingResolvedData {
  if (!isObjectRecord(value)) return false
  const { entry, selectedOptimization } = value

  return isServerTrackingBaselineEntry(entry) && isObjectRecord(selectedOptimization)
}

describe('getServerTrackingAttributes', () => {
  it('maps Node resolveOptimizedEntry output to Web tracking attributes', () => {
    expect(
      getServerTrackingAttributes(baselineEntry, resolvedData, {
        clickable: true,
        hoverDurationUpdateIntervalMs: 1000,
        trackClicks: true,
        trackHovers: false,
        trackViews: true,
        viewDurationUpdateIntervalMs: 2500,
      }),
    ).toEqual({
      'data-ctfl-baseline-id': 'baseline-entry',
      'data-ctfl-clickable': true,
      'data-ctfl-duplication-scope': 'profile',
      'data-ctfl-entry-id': 'variant-entry',
      'data-ctfl-hover-duration-update-interval-ms': 1000,
      'data-ctfl-optimization-id': 'experience-id',
      'data-ctfl-sticky': true,
      'data-ctfl-track-clicks': true,
      'data-ctfl-track-hovers': false,
      'data-ctfl-track-views': true,
      'data-ctfl-variant-index': 2,
      'data-ctfl-view-duration-update-interval-ms': 2500,
    })
  })
})
