import type { Profile } from '@contentful/optimization-api-client'

export const profile: Profile = {
  id: '',
  stableId: '',
  random: 0,
  audiences: [],
  traits: {
    firstname: 'John',
    nested: {
      foo: 'bar',
      baz: { qux: 'grml' },
      baz_qux: 'quux',
    },
    non_nested: 123,
  },
  location: {
    continent: 'EU',
  },
  session: {
    id: '1a2b3c4d5e6f7g8h9i0j',
    isReturningVisitor: false,
    landingPage: {
      url: '',
      referrer: '',
      query: {},
      search: '',
      path: '',
    },
    count: 2,
    activeSessionLength: 12,
    averageSessionLength: 43,
  },
}
