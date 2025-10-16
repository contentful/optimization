import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@contentful/optimization-api-client': resolve(
        __dirname,
        '../../platforms/javascript/api-client/src/',
      ),
      '@contentful/optimization-core': resolve(__dirname, '../../platforms/javascript/core/src/'),
      '@contentful/optimization-node': resolve(__dirname, '../../platforms/javascript/node/src/'),
    },
  },
  test: {
    include: ['**/*.test.?(c|m)[jt]s?(x)'],
    globals: true,
    coverage: {
      include: ['src/**/*'],
      reporter: ['text', 'html'],
    },
  },
})
