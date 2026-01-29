import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: 'esm',
    dts: true, // Only generate types once (for ESM)
    clean: true,
    // Uses default tsconfig.json (ESM/types)
    outExtension: () => ({ js: '.mjs' }),
  },
  {
    entry: ['src/index.ts'],
    format: 'cjs',
    dts: false, // No types for CJS
    clean: false,
    tsconfig: 'tsconfig.cjs.json', // Use CJS-specific config
    outExtension: () => ({ js: '.cjs' }),
  },
])