import { defineConfig } from '@rstest/core'
import { resolve } from 'node:path'

const coverageReporters =
  process.env.CI === 'true' ? ['text-summary', 'lcov'] : ['text', 'json', 'html']

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
      '@contentful/optimization-core': resolve(__dirname, '../../../universal/core/src/index.ts'),
      '@react-native-community/netinfo': resolve(
        __dirname,
        './__mocks__/@react-native-community/netinfo.ts',
      ),
      logger: resolve(__dirname, '../../../lib/logger/src/'),
      'mocks/loggerMock': resolve(__dirname, '../../../lib/mocks/src/loggerMock.ts'),
      'react-native': resolve(__dirname, './src/test/reactNativeShim.ts'),
    },
  },
  include: ['**/*.test.?(c|m)[jt]s?(x)'],
  globals: true,
  testEnvironment: 'node',
  coverage: {
    reporters: coverageReporters,
    include: ['src/**/*.{ts,tsx}'],
    exclude: ['**/*.test.ts', '**/*.test.tsx', '**/test/**'],
  },
})
