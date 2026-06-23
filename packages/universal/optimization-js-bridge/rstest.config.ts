import { defineConfig } from '@rstest/core'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@contentful/optimization-api-client': resolve(__dirname, '../api-client/src/'),
      '@contentful/optimization-api-schemas': resolve(__dirname, '../api-schemas/src/'),
      '@contentful/optimization-core': resolve(__dirname, '../core-sdk/src/'),
    },
  },
  include: ['**/*.test.?(c|m)[jt]s?(x)'],
  globals: true,
  testEnvironment: 'node',
})
