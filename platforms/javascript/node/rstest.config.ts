import { defineConfig } from '@rstest/core'
import { resolve } from 'node:path'

const coverageReporters = process.env.CI === 'true' ? ['text-summary', 'lcov'] : ['text', 'html']

export default defineConfig({
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
      '@contentful/optimization-core': resolve(__dirname, '../../../universal/core/src/'),
      logger: resolve(__dirname, '../../../lib/logger/src/'),
    },
  },
  include: ['**/*.test.?(c|m)[jt]s?(x)'],
  globals: true,
  testEnvironment: 'node',
  coverage: {
    include: ['src/**/*'],
    reporters: coverageReporters,
  },
})
