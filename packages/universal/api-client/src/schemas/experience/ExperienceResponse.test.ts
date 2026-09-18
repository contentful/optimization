import { ExperienceData } from './ExperienceResponse'

const xdaPersonalizationResponse = {
  profile: {
    id: 'profile-1',
    stableId: 'profile-1',
    random: 0.5,
    audiences: [],
    traits: {},
    location: {},
    session: {
      id: 'session-1',
      isReturningVisitor: false,
      landingPage: {
        path: '/',
        query: {},
        referrer: '',
        search: '',
        url: 'https://example.com/',
      },
      count: 1,
      activeSessionLength: 0,
      averageSessionLength: 0,
    },
  },
  experiences: [
    {
      experienceId: 'optimization-2',
      variantIndex: 1,
      variants: { 'experience-1': 'experience-variant-1' },
      sticky: false,
    },
  ],
  changes: [
    {
      type: 'Variable',
      key: 'headline',
      value: 'Hello',
      meta: { experienceId: 'optimization-1', variantIndex: 0 },
    },
    {
      type: 'Experience',
      id: 'experience-1',
      variantId: 'experience-variant-1',
      meta: { optimizationId: 'optimization-2', variantIndex: 1 },
    },
    {
      type: 'Fragment',
      id: 'fragment-1',
      variantId: 'fragment-variant-1',
      meta: { optimizationId: 'optimization-3', variantIndex: 2 },
    },
  ],
}

const xdaResponse = {
  sys: { id: 'experience-delivery-response-1' },
  errors: [],
  extensions: { personalization: xdaPersonalizationResponse },
}

describe('ExperienceData', () => {
  it('parses the complete personalization payload from an XDA response', () => {
    const result = ExperienceData.safeParse(xdaResponse.extensions.personalization)

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data).toEqual(xdaPersonalizationResponse)
  })
})
