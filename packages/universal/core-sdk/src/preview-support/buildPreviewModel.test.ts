import type { Profile } from '@contentful/optimization-api-client/api-schemas'
import { profile as profileFixture } from '../test/fixtures/profile'
import { buildPreviewModel } from './buildPreviewModel'
import { ALL_VISITORS_AUDIENCE_ID } from './constants'
import type { AudienceDefinition, ExperienceDefinition } from './definitions'
import type { PreviewSdkSignals } from './signals'
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
      audienceDefinitions: [audience('2WzXDaWtDmstHl9p8Wufpp'), audience('5Lk9Mn2OpQ4RsT6UvW8XyZ')],
      experienceDefinitions: [
        experience('6IueRX1pS3iMJncbhUQTba', { audienceId: '2WzXDaWtDmstHl9p8Wufpp' }),
        experience('5jT8mNPxQ2rVuY4wZaB6Cd', { audienceId: '5Lk9Mn2OpQ4RsT6UvW8XyZ' }),
      ],
      signals: { ...EMPTY_SIGNALS, profile: makeProfile(['2WzXDaWtDmstHl9p8Wufpp']) },
      overrides: EMPTY_OVERRIDES,
    })

    expect(model.audiencesWithExperiences).toHaveLength(2)
    const [a1, a2] = model.audiencesWithExperiences
    expect(a1?.audience.id).toBe('2WzXDaWtDmstHl9p8Wufpp')
    expect(a1?.isQualified).toBe(true)
    expect(a1?.isActive).toBe(true)
    expect(a1?.overrideState).toBe('default')
    expect(a1?.experiences.map((e) => e.id)).toEqual(['6IueRX1pS3iMJncbhUQTba'])

    expect(a2?.audience.id).toBe('5Lk9Mn2OpQ4RsT6UvW8XyZ')
    expect(a2?.isQualified).toBe(false)
    expect(a2?.isActive).toBe(false)
    expect(a2?.overrideState).toBe('default')
  })

  test("override 'on' forces isActive true even when user is unqualified", () => {
    const model = buildPreviewModel({
      audienceDefinitions: [audience('2WzXDaWtDmstHl9p8Wufpp')],
      experienceDefinitions: [
        experience('6IueRX1pS3iMJncbhUQTba', { audienceId: '2WzXDaWtDmstHl9p8Wufpp' }),
      ],
      signals: EMPTY_SIGNALS,
      overrides: {
        audiences: {
          '2WzXDaWtDmstHl9p8Wufpp': {
            audienceId: '2WzXDaWtDmstHl9p8Wufpp',
            isActive: true,
            source: 'manual',
            experienceIds: ['6IueRX1pS3iMJncbhUQTba'],
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
      audienceDefinitions: [audience('2WzXDaWtDmstHl9p8Wufpp')],
      experienceDefinitions: [
        experience('6IueRX1pS3iMJncbhUQTba', { audienceId: '2WzXDaWtDmstHl9p8Wufpp' }),
      ],
      signals: { ...EMPTY_SIGNALS, profile: makeProfile(['2WzXDaWtDmstHl9p8Wufpp']) },
      overrides: {
        audiences: {
          '2WzXDaWtDmstHl9p8Wufpp': {
            audienceId: '2WzXDaWtDmstHl9p8Wufpp',
            isActive: false,
            source: 'manual',
            experienceIds: ['6IueRX1pS3iMJncbhUQTba'],
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
      audienceDefinitions: [audience('2WzXDaWtDmstHl9p8Wufpp')],
      experienceDefinitions: [
        experience('6IueRX1pS3iMJncbhUQTba'),
        experience('5jT8mNPxQ2rVuY4wZaB6Cd', { audienceId: '2WzXDaWtDmstHl9p8Wufpp' }),
      ],
      signals: EMPTY_SIGNALS,
      overrides: EMPTY_OVERRIDES,
    })
    expect(model.unassociatedExperiences.map((e) => e.id)).toEqual(['6IueRX1pS3iMJncbhUQTba'])
    const allVisitors = model.audiencesWithExperiences.find(
      (a) => a.audience.id === ALL_VISITORS_AUDIENCE_ID,
    )
    expect(allVisitors).toBeDefined()
    expect(allVisitors?.isQualified).toBe(true)
    expect(allVisitors?.isActive).toBe(true)
    expect(allVisitors?.experiences.map((e) => e.id)).toEqual(['6IueRX1pS3iMJncbhUQTba'])
  })

  test("All-Visitors respects override 'off'", () => {
    const model = buildPreviewModel({
      audienceDefinitions: [],
      experienceDefinitions: [experience('6IueRX1pS3iMJncbhUQTba')],
      signals: EMPTY_SIGNALS,
      overrides: {
        audiences: {
          [ALL_VISITORS_AUDIENCE_ID]: {
            audienceId: ALL_VISITORS_AUDIENCE_ID,
            isActive: false,
            source: 'manual',
            experienceIds: ['6IueRX1pS3iMJncbhUQTba'],
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
          { experienceId: '6IueRX1pS3iMJncbhUQTba', variantIndex: 2, variants: {} },
          { experienceId: '5jT8mNPxQ2rVuY4wZaB6Cd', variantIndex: 0, variants: {} },
        ],
      },
      overrides: EMPTY_OVERRIDES,
    })
    expect(model.sdkVariantIndices).toEqual({
      '6IueRX1pS3iMJncbhUQTba': 2,
      '5jT8mNPxQ2rVuY4wZaB6Cd': 0,
    })
  })

  test('experience pointing at non-existent audience goes into unassociated', () => {
    const model = buildPreviewModel({
      audienceDefinitions: [audience('2WzXDaWtDmstHl9p8Wufpp')],
      experienceDefinitions: [
        experience('8RsT1UvW3XyZ5AbC7DeFgH', { audienceId: '8L0sR4oV6xY8zA0bC2dEfG' }),
        experience('7LcA9DeF2GhI4JkL6MnOpQ', { audienceId: '2WzXDaWtDmstHl9p8Wufpp' }),
      ],
      signals: EMPTY_SIGNALS,
      overrides: EMPTY_OVERRIDES,
    })
    expect(model.unassociatedExperiences.map((e) => e.id)).toEqual(['8RsT1UvW3XyZ5AbC7DeFgH'])
    const allVisitors = model.audiencesWithExperiences.find(
      (a) => a.audience.id === ALL_VISITORS_AUDIENCE_ID,
    )
    expect(allVisitors?.experiences.map((e) => e.id)).toEqual(['8RsT1UvW3XyZ5AbC7DeFgH'])
  })

  describe('per-experience state enrichment', () => {
    test('currentVariantIndex reflects sdkVariantIndices', () => {
      const model = buildPreviewModel({
        audienceDefinitions: [audience('2WzXDaWtDmstHl9p8Wufpp')],
        experienceDefinitions: [
          experience('6IueRX1pS3iMJncbhUQTba', { audienceId: '2WzXDaWtDmstHl9p8Wufpp' }),
        ],
        signals: {
          ...EMPTY_SIGNALS,
          selectedOptimizations: [
            { experienceId: '6IueRX1pS3iMJncbhUQTba', variantIndex: 3, variants: {} },
          ],
        },
        overrides: EMPTY_OVERRIDES,
      })
      const [a1] = model.audiencesWithExperiences
      expect(a1?.experiences[0]?.currentVariantIndex).toBe(3)
    })

    test('currentVariantIndex defaults to 0 when no selection is present', () => {
      const model = buildPreviewModel({
        audienceDefinitions: [audience('2WzXDaWtDmstHl9p8Wufpp')],
        experienceDefinitions: [
          experience('6IueRX1pS3iMJncbhUQTba', { audienceId: '2WzXDaWtDmstHl9p8Wufpp' }),
        ],
        signals: EMPTY_SIGNALS,
        overrides: EMPTY_OVERRIDES,
      })
      const [a1] = model.audiencesWithExperiences
      expect(a1?.experiences[0]?.currentVariantIndex).toBe(0)
    })

    test('isOverridden tracks membership in overrides.selectedOptimizations', () => {
      const model = buildPreviewModel({
        audienceDefinitions: [audience('2WzXDaWtDmstHl9p8Wufpp')],
        experienceDefinitions: [
          experience('6IueRX1pS3iMJncbhUQTba', { audienceId: '2WzXDaWtDmstHl9p8Wufpp' }),
          experience('5jT8mNPxQ2rVuY4wZaB6Cd', { audienceId: '2WzXDaWtDmstHl9p8Wufpp' }),
        ],
        signals: EMPTY_SIGNALS,
        overrides: {
          audiences: {},
          selectedOptimizations: {
            '6IueRX1pS3iMJncbhUQTba': { experienceId: '6IueRX1pS3iMJncbhUQTba', variantIndex: 2 },
          },
        },
      })
      const [a1] = model.audiencesWithExperiences
      const byId = Object.fromEntries((a1?.experiences ?? []).map((e) => [e.id, e]))
      expect(byId['6IueRX1pS3iMJncbhUQTba']?.isOverridden).toBe(true)
      expect(byId['5jT8mNPxQ2rVuY4wZaB6Cd']?.isOverridden).toBe(false)
    })

    test('naturalVariantIndex is undefined when not overridden', () => {
      const model = buildPreviewModel({
        audienceDefinitions: [audience('2WzXDaWtDmstHl9p8Wufpp')],
        experienceDefinitions: [
          experience('6IueRX1pS3iMJncbhUQTba', { audienceId: '2WzXDaWtDmstHl9p8Wufpp' }),
        ],
        signals: {
          ...EMPTY_SIGNALS,
          selectedOptimizations: [
            { experienceId: '6IueRX1pS3iMJncbhUQTba', variantIndex: 1, variants: {} },
          ],
        },
        overrides: EMPTY_OVERRIDES,
        baselineSelectedOptimizations: [
          { experienceId: '6IueRX1pS3iMJncbhUQTba', variantIndex: 1, variants: {} },
        ],
      })
      const [a1] = model.audiencesWithExperiences
      expect(a1?.experiences[0]?.naturalVariantIndex).toBeUndefined()
    })

    test('naturalVariantIndex is sourced from baseline when overridden', () => {
      const model = buildPreviewModel({
        audienceDefinitions: [audience('2WzXDaWtDmstHl9p8Wufpp')],
        experienceDefinitions: [
          experience('6IueRX1pS3iMJncbhUQTba', { audienceId: '2WzXDaWtDmstHl9p8Wufpp' }),
        ],
        signals: {
          ...EMPTY_SIGNALS,
          selectedOptimizations: [
            { experienceId: '6IueRX1pS3iMJncbhUQTba', variantIndex: 2, variants: {} },
          ],
        },
        overrides: {
          audiences: {},
          selectedOptimizations: {
            '6IueRX1pS3iMJncbhUQTba': { experienceId: '6IueRX1pS3iMJncbhUQTba', variantIndex: 2 },
          },
        },
        baselineSelectedOptimizations: [
          { experienceId: '6IueRX1pS3iMJncbhUQTba', variantIndex: 0, variants: {} },
        ],
      })
      const [a1] = model.audiencesWithExperiences
      expect(a1?.experiences[0]?.isOverridden).toBe(true)
      expect(a1?.experiences[0]?.naturalVariantIndex).toBe(0)
    })

    test('naturalVariantIndex is omitted when no baseline snapshot is supplied', () => {
      const model = buildPreviewModel({
        audienceDefinitions: [audience('2WzXDaWtDmstHl9p8Wufpp')],
        experienceDefinitions: [
          experience('6IueRX1pS3iMJncbhUQTba', { audienceId: '2WzXDaWtDmstHl9p8Wufpp' }),
        ],
        signals: EMPTY_SIGNALS,
        overrides: {
          audiences: {},
          selectedOptimizations: {
            '6IueRX1pS3iMJncbhUQTba': { experienceId: '6IueRX1pS3iMJncbhUQTba', variantIndex: 1 },
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
        audienceDefinitions: [audience('2WzXDaWtDmstHl9p8Wufpp', 'Alpha')],
        experienceDefinitions: [
          experience('8RsT1UvW3XyZ5AbC7DeFgH'),
          experience('7LcA9DeF2GhI4JkL6MnOpQ', { audienceId: '2WzXDaWtDmstHl9p8Wufpp' }),
        ],
        signals: EMPTY_SIGNALS,
        overrides: EMPTY_OVERRIDES,
      })
      expect(model.audiencesWithExperiences[0]?.audience.id).toBe(ALL_VISITORS_AUDIENCE_ID)
    })

    test('qualification does not affect audience order', () => {
      // "Apple" qualifies and "Banana" does not, but alphabetical order wins
      // — the panel must stay stable when an override flips an audience's
      // active state.
      const model = buildPreviewModel({
        audienceDefinitions: [
          audience('5R6yX0uB2dE4gH6iJ8kLmN', 'Banana'),
          audience('4Q5xW9tA1cD3fG5hI7jKlM', 'Apple'),
        ],
        experienceDefinitions: [],
        signals: { ...EMPTY_SIGNALS, profile: makeProfile(['4Q5xW9tA1cD3fG5hI7jKlM']) },
        overrides: EMPTY_OVERRIDES,
      })
      expect(model.audiencesWithExperiences.map((a) => a.audience.id)).toEqual([
        '4Q5xW9tA1cD3fG5hI7jKlM',
        '5R6yX0uB2dE4gH6iJ8kLmN',
      ])
    })

    test('audiences are sorted alphabetically by name', () => {
      const model = buildPreviewModel({
        audienceDefinitions: [
          audience('6S7zY1vC3eF5hI7jK9lMnO', 'Charlie'),
          audience('4Q5xW9tA1cD3fG5hI7jKlM', 'Alpha'),
          audience('5R6yX0uB2dE4gH6iJ8kLmN', 'Bravo'),
        ],
        experienceDefinitions: [],
        signals: {
          ...EMPTY_SIGNALS,
          profile: makeProfile([
            '4Q5xW9tA1cD3fG5hI7jKlM',
            '5R6yX0uB2dE4gH6iJ8kLmN',
            '6S7zY1vC3eF5hI7jK9lMnO',
          ]),
        },
        overrides: EMPTY_OVERRIDES,
      })
      expect(model.audiencesWithExperiences.map((a) => a.audience.name)).toEqual([
        'Alpha',
        'Bravo',
        'Charlie',
      ])
    })

    test('ordering is deterministic for a known mixed input', () => {
      // Names: Acorn (q1), Alpha (u1), Beta (q2), Zeta (u2). All-Visitors
      // first, then strict alphabetical regardless of qualification.
      const model = buildPreviewModel({
        audienceDefinitions: [
          audience('3P4wV8sZ0bC2eF4gH6iJkL', 'Zeta'),
          audience('2O3vU7rY9aB1dE3fG5hIjK', 'Beta'),
          audience('1N2uT6qX8zA0cD2eF4gHiJ', 'Alpha'),
          audience('9M1tS5pW7yZ9bC1dE3fGhI', 'Acorn'),
        ],
        experienceDefinitions: [experience('8RsT1UvW3XyZ5AbC7DeFgH')],
        signals: {
          ...EMPTY_SIGNALS,
          profile: makeProfile(['9M1tS5pW7yZ9bC1dE3fGhI', '2O3vU7rY9aB1dE3fG5hIjK']),
        },
        overrides: EMPTY_OVERRIDES,
      })
      expect(model.audiencesWithExperiences.map((a) => a.audience.id)).toEqual([
        ALL_VISITORS_AUDIENCE_ID,
        '9M1tS5pW7yZ9bC1dE3fGhI',
        '1N2uT6qX8zA0cD2eF4gHiJ',
        '2O3vU7rY9aB1dE3fG5hIjK',
        '3P4wV8sZ0bC2eF4gH6iJkL',
      ])
    })
  })
})
