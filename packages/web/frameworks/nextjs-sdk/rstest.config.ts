import { pluginReact } from '@rsbuild/plugin-react'
import { defineConfig } from '@rstest/core'
import { resolve } from 'node:path'

const coverageReporters = process.env.CI === 'true' ? ['text-summary', 'lcov'] : ['text', 'html']

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    define: {
      __OPTIMIZATION_VERSION__: JSON.stringify('9.8.7'),
    },
  },
  resolve: {
    alias: {
      '@contentful/optimization-api-client': resolve(
        __dirname,
        '../../../universal/api-client/src/',
      ),
      '@contentful/optimization-api-schemas': resolve(
        __dirname,
        '../../../universal/api-schemas/src/',
      ),
      '@contentful/optimization-core': resolve(__dirname, '../../../universal/core-sdk/src/'),
      '@contentful/optimization-node': resolve(__dirname, '../../../node/node-sdk/src/'),
      '@contentful/optimization-react-web': resolve(__dirname, '../react-web-sdk/src/'),
      '@contentful/optimization-web': resolve(__dirname, '../../web-sdk/src/'),
    },
  },
  include: ['**/*.test.?(c|m)[jt]s?(x)'],
  globals: true,
  testEnvironment: 'happy-dom',
  coverage: {
    include: ['src/**/*.ts', 'src/**/*.tsx'],
    reporters: coverageReporters,
  },
})
