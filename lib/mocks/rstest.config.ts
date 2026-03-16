import { defineConfig } from '@rstest/core'

const coverageReporters = process.env.CI === 'true' ? ['text-summary', 'lcov'] : ['text', 'html']

export default defineConfig({
  include: ['**/*.test.?(c|m)[jt]s?(x)'],
  globals: true,
  testEnvironment: 'node',
  coverage: {
    exclude: ['**/test/*', '**/*.d.ts'],
    include: ['src/**/*.{ts,tsx,js,jsx,mts,cts}'],
    reporters: coverageReporters,
  },
})
