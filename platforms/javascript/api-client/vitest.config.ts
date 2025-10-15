import { defineConfig } from 'vitest/config'

export default defineConfig({
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
