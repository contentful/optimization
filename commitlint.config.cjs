const scopes = [
  'android',
  'api-client',
  'api-schemas',
  'bridge',
  'build-tools',
  'ci',
  'core',
  'deps',
  'docs',
  'implementations',
  'nextjs',
  'node',
  'publish',
  'react-native',
  'react-web',
  'repo',
  'swift',
  'test',
  'web',
  'web-preview-panel',
]
const scopeEnum = Object.fromEntries(
  scopes.map((scope) => [
    scope,
    {
      description: scope,
      title: scope,
    },
  ]),
)

module.exports = {
  extends: ['@commitlint/config-conventional'],
  prompt: {
    questions: {
      scope: {
        enum: scopeEnum,
      },
    },
  },
  rules: {
    'scope-empty': [2, 'never'],
    'scope-enum': [2, 'always', scopes],
  },
}
