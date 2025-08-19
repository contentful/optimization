import js from '@eslint/js'
import love from 'eslint-config-love'
import prettier from 'eslint-config-prettier'
import typescript, { type ConfigArray } from 'typescript-eslint'

const config: ConfigArray = typescript.config(
  {
    ignores: ['**/node_modules', '**/coverage', '**/dist', '**/*.{js,jsx,cjs,mjs}'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,cjs,mjs,ts,tsx}'],
    ...love,
  },
  typescript.configs.strict,
  typescript.configs.stylistic,
  {
    rules: {
      '@typescript-eslint/no-magic-numbers': ['error', { ignore: [-1, 0, 1] }],
      '@typescript-eslint/class-methods-use-this': [
        'error',
        { ignoreClassesThatImplementAnInterface: true },
      ],
      '@typescript-eslint/strict-boolean-expressions': 'off',
    },
  },
  {
    // https://github.com/vitest-dev/vitest/issues/4543#issuecomment-1824628142
    files: ['**/src/**/*.test.ts', '**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/init-declarations': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/unbound-method': 'off',
      'max-nested-callbacks': 'off',
      'promise/avoid-new': 'off',
    },
  },
  prettier,
)

export default config
