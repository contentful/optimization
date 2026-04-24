import type { Profile } from '@contentful/optimization-api-client/api-schemas'
import { buildPreviewModel } from './buildPreviewModel'
import { ALL_VISITORS_AUDIENCE_ID } from './constants'
import type { AudienceDefinition, ExperienceDefinition } from './definitions'
import type { PreviewSdkSignals } from './signals'
import { profile as profileFixture } from './test/fixtures/profile'
import type { OverrideState } from './types'

const EMPTY_SIGNALS: PreviewSdkSignals = {
  profile: undefined,
  selectedOptimizations: undefined,
  consent: undefined,
  isLoading: false,
}

const EMPTY_OVERRIDES: OverrideState = {
  audiences: {},
  selectedOptimizations: {},
}

function audience(id: string, name = id): AudienceDefinition {
  return { id, name }
}

function experience(
  id: string,
  opts: { audienceId?: string; name?: string } = {},
): ExperienceDefinition {
  return {
    id,
    name: opts.name ?? id,
    type: 'nt_personalization',
    distribution: [],
    audience: opts.audienceId ? { id: opts.audienceId } : undefined,
  }
}

function makeProfile(audienceIds: string[]): Profile {
  return { ...profileFixture, audiences: audienceIds }
}

describe('buildPreviewModel', () => {
  test('empty input → hasData is false, lists are empty', () => {
    const model = buildPreviewModel({
      audienceDefinitions: [],
      experienceDefinitions: [],
      signals: EMPTY_SIGNALS,
      overrides: EMPTY_OVERRIDES,
    })
    expect(model.hasData).toBe(false)
    expect(model.audiencesWithExperiences).toEqual([])
    expect(model.unassociatedExperiences).toEqual([])
    expect(model.sdkVariantIndices).toEqual({})
  })

  test('groups experiences by audience and marks qualified via profile.audiences', () => {
    const model = buildPreviewModel({
      audienceDefinitions: [audience('aud-1'), audience('aud-2')],
      experienceDefinitions: [
        experience('exp-1', { audienceId: 'aud-1' }),
        experience('exp-2', { audienceId: 'aud-2' }),
      ],
      signals: { ...EMPTY_SIGNALS, profile: makeProfile(['aud-1']) },
      overrides: EMPTY_OVERRIDES,
    })

    expect(model.audiencesWithExperiences).toHaveLength(2)
    const [a1, a2] = model.audiencesWithExperiences
    expect(a1?.audience.id).toBe('aud-1')
    expect(a1?.isQualified).toBe(true)
    expect(a1?.isActive).toBe(true)
    expect(a1?.overrideState).toBe('default')
    expect(a1?.experiences.map((e) => e.id)).toEqual(['exp-1'])

    expect(a2?.audience.id).toBe('aud-2')
    expect(a2?.isQualified).toBe(false)
    expect(a2?.isActive).toBe(false)
    expect(a2?.overrideState).toBe('default')
  })

  test("override 'on' forces isActive true even when user is unqualified", () => {
    const model = buildPreviewModel({
      audienceDefinitions: [audience('aud-1')],
      experienceDefinitions: [experience('exp-1', { audienceId: 'aud-1' })],
      signals: EMPTY_SIGNALS,
      overrides: {
        audiences: {
          'aud-1': {
            audienceId: 'aud-1',
            isActive: true,
            source: 'manual',
            experienceIds: ['exp-1'],
          },
        },
        selectedOptimizations: {},
      },
    })
    const [a1] = model.audiencesWithExperiences
    expect(a1?.isQualified).toBe(false)
    expect(a1?.isActive).toBe(true)
    expect(a1?.overrideState).toBe('on')
  })

  test("override 'off' forces isActive false even when user is qualified", () => {
    const model = buildPreviewModel({
      audienceDefinitions: [audience('aud-1')],
      experienceDefinitions: [experience('exp-1', { audienceId: 'aud-1' })],
      signals: { ...EMPTY_SIGNALS, profile: makeProfile(['aud-1']) },
      overrides: {
        audiences: {
          'aud-1': {
            audienceId: 'aud-1',
            isActive: false,
            source: 'manual',
            experienceIds: ['exp-1'],
          },
        },
        selectedOptimizations: {},
      },
    })
    const [a1] = model.audiencesWithExperiences
    expect(a1?.isQualified).toBe(true)
    expect(a1?.isActive).toBe(false)
    expect(a1?.overrideState).toBe('off')
  })

  test('unassociated experiences produce All-Visitors bucket qualified and active by default', () => {
    const model = buildPreviewModel({
      audienceDefinitions: [audience('aud-1')],
      experienceDefinitions: [experience('exp-1'), experience('exp-2', { audienceId: 'aud-1' })],
      signals: EMPTY_SIGNALS,
      overrides: EMPTY_OVERRIDES,
    })
    expect(model.unassociatedExperiences.map((e) => e.id)).toEqual(['exp-1'])
    const allVisitors = model.audiencesWithExperiences.find(
      (a) => a.audience.id === ALL_VISITORS_AUDIENCE_ID,
    )
    expect(allVisitors).toBeDefined()
    expect(allVisitors?.isQualified).toBe(true)
    expect(allVisitors?.isActive).toBe(true)
    expect(allVisitors?.experiences.map((e) => e.id)).toEqual(['exp-1'])
  })

  test("All-Visitors respects override 'off'", () => {
    const model = buildPreviewModel({
      audienceDefinitions: [],
      experienceDefinitions: [experience('exp-1')],
      signals: EMPTY_SIGNALS,
      overrides: {
        audiences: {
          [ALL_VISITORS_AUDIENCE_ID]: {
            audienceId: ALL_VISITORS_AUDIENCE_ID,
            isActive: false,
            source: 'manual',
            experienceIds: ['exp-1'],
          },
        },
        selectedOptimizations: {},
      },
    })
    const [av] = model.audiencesWithExperiences
    expect(av?.audience.id).toBe(ALL_VISITORS_AUDIENCE_ID)
    expect(av?.overrideState).toBe('off')
    expect(av?.isActive).toBe(false)
  })

  test('sdkVariantIndices is derived from selectedOptimizations', () => {
    const model = buildPreviewModel({
      audienceDefinitions: [],
      experienceDefinitions: [],
      signals: {
        ...EMPTY_SIGNALS,
        selectedOptimizations: [
          { experienceId: 'exp-1', variantIndex: 2, variants: {} },
          { experienceId: 'exp-2', variantIndex: 0, variants: {} },
        ],
      },
      overrides: EMPTY_OVERRIDES,
    })
    expect(model.sdkVariantIndices).toEqual({ 'exp-1': 2, 'exp-2': 0 })
  })

  test('experience pointing at non-existent audience goes into unassociated', () => {
    const model = buildPreviewModel({
      audienceDefinitions: [audience('aud-1')],
      experienceDefinitions: [
        experience('exp-orphan', { audienceId: 'aud-missing' }),
        experience('exp-targeted', { audienceId: 'aud-1' }),
      ],
      signals: EMPTY_SIGNALS,
      overrides: EMPTY_OVERRIDES,
    })
    expect(model.unassociatedExperiences.map((e) => e.id)).toEqual(['exp-orphan'])
    const allVisitors = model.audiencesWithExperiences.find(
      (a) => a.audience.id === ALL_VISITORS_AUDIENCE_ID,
    )
    expect(allVisitors?.experiences.map((e) => e.id)).toEqual(['exp-orphan'])
  })

  describe('per-experience state enrichment', () => {
    test('currentVariantIndex reflects sdkVariantIndices', () => {
      const model = buildPreviewModel({
        audienceDefinitions: [audience('aud-1')],
        experienceDefinitions: [experience('exp-1', { audienceId: 'aud-1' })],
        signals: {
          ...EMPTY_SIGNALS,
          selectedOptimizations: [{ experienceId: 'exp-1', variantIndex: 3, variants: {} }],
        },
        overrides: EMPTY_OVERRIDES,
      })
      const [a1] = model.audiencesWithExperiences
      expect(a1?.experiences[0]?.currentVariantIndex).toBe(3)
    })

    test('currentVariantIndex defaults to 0 when no selection is present', () => {
      const model = buildPreviewModel({
        audienceDefinitions: [audience('aud-1')],
        experienceDefinitions: [experience('exp-1', { audienceId: 'aud-1' })],
        signals: EMPTY_SIGNALS,
        overrides: EMPTY_OVERRIDES,
      })
      const [a1] = model.audiencesWithExperiences
      expect(a1?.experiences[0]?.currentVariantIndex).toBe(0)
    })

    test('isOverridden tracks membership in overrides.selectedOptimizations', () => {
      const model = buildPreviewModel({
        audienceDefinitions: [audience('aud-1')],
        experienceDefinitions: [
          experience('exp-a', { audienceId: 'aud-1' }),
          experience('exp-b', { audienceId: 'aud-1' }),
        ],
        signals: EMPTY_SIGNALS,
        overrides: {
          audiences: {},
          selectedOptimizations: {
            'exp-a': { experienceId: 'exp-a', variantIndex: 2 },
          },
        },
      })
      const [a1] = model.audiencesWithExperiences
      const byId = Object.fromEntries((a1?.experiences ?? []).map((e) => [e.id, e]))
      expect(byId['exp-a']?.isOverridden).toBe(true)
      expect(byId['exp-b']?.isOverridden).toBe(false)
    })

    test('naturalVariantIndex is undefined when not overridden', () => {
      const model = buildPreviewModel({
        audienceDefinitions: [audience('aud-1')],
        experienceDefinitions: [experience('exp-1', { audienceId: 'aud-1' })],
        signals: {
          ...EMPTY_SIGNALS,
          selectedOptimizations: [{ experienceId: 'exp-1', variantIndex: 1, variants: {} }],
        },
        overrides: EMPTY_OVERRIDES,
        baselineSelectedOptimizations: [{ experienceId: 'exp-1', variantIndex: 1, variants: {} }],
      })
      const [a1] = model.audiencesWithExperiences
      expect(a1?.experiences[0]?.naturalVariantIndex).toBeUndefined()
    })

    test('naturalVariantIndex is sourced from baseline when overridden', () => {
      const model = buildPreviewModel({
        audienceDefinitions: [audience('aud-1')],
        experienceDefinitions: [experience('exp-1', { audienceId: 'aud-1' })],
        signals: {
          ...EMPTY_SIGNALS,
          selectedOptimizations: [{ experienceId: 'exp-1', variantIndex: 2, variants: {} }],
        },
        overrides: {
          audiences: {},
          selectedOptimizations: {
            'exp-1': { experienceId: 'exp-1', variantIndex: 2 },
          },
        },
        baselineSelectedOptimizations: [{ experienceId: 'exp-1', variantIndex: 0, variants: {} }],
      })
      const [a1] = model.audiencesWithExperiences
      expect(a1?.experiences[0]?.isOverridden).toBe(true)
      expect(a1?.experiences[0]?.naturalVariantIndex).toBe(0)
    })

    test('naturalVariantIndex is omitted when no baseline snapshot is supplied', () => {
      const model = buildPreviewModel({
        audienceDefinitions: [audience('aud-1')],
        experienceDefinitions: [experience('exp-1', { audienceId: 'aud-1' })],
        signals: EMPTY_SIGNALS,
        overrides: {
          audiences: {},
          selectedOptimizations: {
            'exp-1': { experienceId: 'exp-1', variantIndex: 1 },
          },
        },
      })
      const [a1] = model.audiencesWithExperiences
      expect(a1?.experiences[0]?.isOverridden).toBe(true)
      expect(a1?.experiences[0]?.naturalVariantIndex).toBeUndefined()
    })
  })

  describe('audience ordering', () => {
    test('All-Visitors bucket is placed first', () => {
      const model = buildPreviewModel({
        audienceDefinitions: [audience('aud-1', 'Alpha')],
        experienceDefinitions: [
          experience('exp-orphan'),
          experience('exp-targeted', { audienceId: 'aud-1' }),
        ],
        signals: EMPTY_SIGNALS,
        overrides: EMPTY_OVERRIDES,
      })
      expect(model.audiencesWithExperiences[0]?.audience.id).toBe(ALL_VISITORS_AUDIENCE_ID)
    })

    test('qualified audiences are sorted before unqualified', () => {
      const model = buildPreviewModel({
        audienceDefinitions: [audience('aud-b', 'Banana'), audience('aud-a', 'Apple')],
        experienceDefinitions: [],
        signals: { ...EMPTY_SIGNALS, profile: makeProfile(['aud-b']) },
        overrides: EMPTY_OVERRIDES,
      })
      expect(model.audiencesWithExperiences.map((a) => a.audience.id)).toEqual(['aud-b', 'aud-a'])
    })

    test('audiences with the same activation state break ties alphabetically by name', () => {
      const model = buildPreviewModel({
        audienceDefinitions: [
          audience('aud-c', 'Charlie'),
          audience('aud-a', 'Alpha'),
          audience('aud-b', 'Bravo'),
        ],
        experienceDefinitions: [],
        signals: { ...EMPTY_SIGNALS, profile: makeProfile(['aud-a', 'aud-b', 'aud-c']) },
        overrides: EMPTY_OVERRIDES,
      })
      expect(model.audiencesWithExperiences.map((a) => a.audience.name)).toEqual([
        'Alpha',
        'Bravo',
        'Charlie',
      ])
    })

    test('ordering is deterministic for a known mixed input', () => {
      const model = buildPreviewModel({
        audienceDefinitions: [
          audience('aud-u2', 'Zeta'),
          audience('aud-q2', 'Beta'),
          audience('aud-u1', 'Alpha'),
          audience('aud-q1', 'Acorn'),
        ],
        experienceDefinitions: [experience('exp-orphan')],
        signals: { ...EMPTY_SIGNALS, profile: makeProfile(['aud-q1', 'aud-q2']) },
        overrides: EMPTY_OVERRIDES,
      })
      expect(model.audiencesWithExperiences.map((a) => a.audience.id)).toEqual([
        ALL_VISITORS_AUDIENCE_ID,
        'aud-q1',
        'aud-q2',
        'aud-u1',
        'aud-u2',
      ])
    })
  })
})
