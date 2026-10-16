const { existsSync } = require('node:fs')
const path = require('node:path')

const envFile = path.join(__dirname, '.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)

// Resolve dev settings at build time; no environment loader ships in the native app.
function inlineDevEnvironment({ types }) {
  return {
    visitor: {
      MemberExpression(expression) {
        const { node } = expression
        if (
          !expression.get('object').matchesPattern('process.env') ||
          node.computed ||
          !types.isIdentifier(node.property) ||
          (!node.property.name.startsWith('PUBLIC_') && node.property.name !== 'MOCK_SERVER_PORT')
        )
          return
        const value = process.env[node.property.name]
        expression.replaceWith(
          value === undefined ? types.identifier('undefined') : types.stringLiteral(value),
        )
      },
    },
  }
}

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    inlineDevEnvironment,
    ['@babel/plugin-proposal-decorators', { version: '2023-05' }],
    '@babel/plugin-transform-class-static-block',
    '@babel/plugin-transform-export-namespace-from',
  ],
}
