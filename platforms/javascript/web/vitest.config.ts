import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@contentful/optimization-core': path.resolve(__dirname, '../core/src/'),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.?(c|m)[jt]s?(x)'],
    globals: true,
    coverage: {
      include: ['src/**/*'],
      reporter: ['text', 'html'],
    },
  },
})
