import { Profile } from '.'

const profile = {
  id: 'profile-1',
  stableId: 'profile-1',
  random: 0.5,
  audiences: [],
  traits: {},
  location: {},
  session: {
    isReturningVisitor: false,
    landingPage: {
      path: '/',
      query: { tag: ['a', 'b'] },
      referrer: '',
      search: '?tag=a&tag=b',
      url: 'https://example.com/?tag=a&tag=b',
    },
    count: 1,
    activeSessionLength: 0,
    averageSessionLength: 0,
  },
}

describe('Profile', () => {
  it('accepts a session without id and a landing page with repeated query keys', () => {
    expect(Profile.safeParse(profile).success).toBe(true)
  })

  it('keeps the jurisdiction the Experience API reports', () => {
    const result = Profile.safeParse({ ...profile, jurisdiction: 'EU' })

    expect(result.success && result.data.jurisdiction).toBe('EU')
  })

  it('rejects an unknown jurisdiction', () => {
    expect(Profile.safeParse({ ...profile, jurisdiction: 'APAC' }).success).toBe(false)
  })
})
