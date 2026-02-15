import { defineConfig } from '@rstest/core'
import { resolve } from 'node:path'

const coverageReporters = process.env.CI === 'true' ? ['text-summary', 'lcov'] : ['text', 'html']

export default defineConfig({
  resolve: {
    alias: {
      '@contentful/optimization-api-client': resolve(__dirname, '../api-client/src/'),
      '@contentful/optimization-api-schemas': resolve(__dirname, '../api-schemas/src/'),
      logger: resolve(__dirname, '../../lib/logger/src/'),
    },
  },
  include: ['**/*.test.?(c|m)[jt]s?(x)'],
  globals: true,
  testEnvironment: 'node',
  setupFiles: ['src/test/setup.ts'],
  coverage: {
    exclude: ['**/test/*'],
    include: ['src/**/*'],
    reporters: coverageReporters,
  },
})
