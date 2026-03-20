import { pluginReact } from '@rsbuild/plugin-react'
import { defineConfig } from '@rstest/core'
import { resolve } from 'node:path'

const coverageReporters = process.env.CI === 'true' ? ['text-summary', 'lcov'] : ['text', 'html']

export default defineConfig({
  plugins: [pluginReact()],
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
      '@contentful/optimization-web': resolve(__dirname, '../../web-sdk/src/'),
      'next/router': resolve(__dirname, './src/test/nextRouterStub.ts'),
    },
  },
  include: ['**/*.test.?(c|m)[jt]s?(x)'],
  globals: true,
  testEnvironment: 'happy-dom',
  setupFiles: ['src/test/setup.ts'],
  coverage: {
    include: ['src/**/*.ts', 'src/**/*.tsx'],
    reporters: coverageReporters,
  },
})
