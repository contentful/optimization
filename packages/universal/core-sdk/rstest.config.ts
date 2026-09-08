import { defineConfig } from '@rstest/core'
import { resolve } from 'node:path'

const coverageReporters = process.env.CI === 'true' ? ['text-summary', 'lcov'] : ['text', 'html']

export default defineConfig({
  resolve: {
    alias: {
      '@contentful/optimization-api-client': resolve(__dirname, '../api-client/src/'),
    },
  },
  include: ['**/*.test.?(c|m)[jt]s?(x)'],
  globals: true,
  testEnvironment: 'node',
  setupFiles: ['src/test/setup.ts'],
  coverage: {
    exclude: ['**/test/*', '**/*.md'],
    include: ['src/**/*'],
    reporters: coverageReporters,
  },
})
