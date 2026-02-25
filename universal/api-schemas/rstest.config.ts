import { defineConfig } from '@rstest/core'

export default defineConfig({
  include: ['**/*.test.?(c|m)[jt]s?(x)'],
  globals: true,
  testEnvironment: 'node',
})
