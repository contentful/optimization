import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@contentful/optimization-api-client': resolve(__dirname, '../api-client/src/'),
      '@contentful/optimization-api-schemas': resolve(__dirname, '../api-schemas/src/'),
      '@contentful/optimization-core': resolve(__dirname, '../core/src/index.ts'),
      'mocks/loggerMock': resolve(__dirname, '../../../lib/mocks/src/loggerMock.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*'],
      exclude: ['**/*.test.ts', '**/test/**'],
    },
  },
})
