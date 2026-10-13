module.exports = {
  preset: '@react-native/jest-preset',
  testMatch: ['<rootDir>/__tests__/**/*.test.tsx'],
  // pnpm dependencies include uncompiled React Native and ESM sources.
  transformIgnorePatterns: [],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironmentOptions: {
    // Jest runs in Node; the native release builds exercise the Metro entry points.
    customExportConditions: ['node', 'node-addons'],
  },
}
