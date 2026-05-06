import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import { defineConfig, globalIgnores } from 'eslint/config'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
  {
    settings: {
      // Fix for ESLint 10+: eslint-plugin-react uses context.getFilename() (legacy API) (this package is used by eslint-config-nex)
      // which was removed in ESLint 10 flat config. Declaring the version explicitly
      // prevents the plugin from trying to auto-detect it and failing.
      // but we will still get lint errors so we need the main lint project to ignore this for now
      react: { version: '19' },
    },
  },
])

export default eslintConfig
