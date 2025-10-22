import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@contentful/optimization-api-schemas': resolve(__dirname, '../api-schemas/src/'),
    },
  },
  test: {
    coverage: {
      exclude: ['**/test/*'],
      include: ['src/**/*'],
      reporter: ['text', 'html'],
    },
    environment: 'node',
    globals: true,
    include: ['**/*.test.?(c|m)[jt]s?(x)'],
    setupFiles: ['src/test/setup.ts'],
  },
})
