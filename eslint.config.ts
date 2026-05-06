import js from '@eslint/js'
import love from 'eslint-config-love'
import prettier from 'eslint-config-prettier'
import { configs as lit } from 'eslint-plugin-lit'
import { configs as wc } from 'eslint-plugin-wc'
import { defineConfig, type Config } from 'eslint/config'
import typescript from 'typescript-eslint'

// `eslint-config-love` currently exposes FlatConfig types that don't line up with ESLint v10 helpers.
// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
const loveConfig = love as unknown as Config
const strictConfigs = Array.isArray(typescript.configs.strict)
  ? typescript.configs.strict
  : [typescript.configs.strict]
const stylisticConfigs = Array.isArray(typescript.configs.stylistic)
  ? typescript.configs.stylistic
  : [typescript.configs.stylistic]
const { pathname: tsconfigRootDir } = new URL('.', import.meta.url)

export default defineConfig(
  {
    ignores: [
      '**/*.{js,jsx,cjs,mjs}',
      '**/.bundle/**',
      '**/.rslib',
      '**/android/**',
      '**/build/**',
      '**/coverage',
      '**/contentful-generated.d.ts',
      '**/dist',
      'docs/media/**',
      '**/ios/**',
      '**/node_modules',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,cjs,mjs,ts,tsx}'],
    ...loveConfig,
  },
  {
    files: ['**/*.{js,jsx,cjs,mjs,ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
    },
  },
  ...strictConfigs,
  ...stylisticConfigs,
  {
    rules: {
      '@typescript-eslint/class-methods-use-this': [
        'error',
        { ignoreClassesThatImplementAnInterface: true },
      ],
      '@typescript-eslint/no-magic-numbers': [
        'error',
        { ignore: [-2, -1, 0, 0.5, 1, 2, 10, 36, 100] },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/strict-boolean-expressions': 'off',
      'eslint-comments/disable-enable-pair': 'off',
      'eslint-comments/no-aggregating-enable': 'off',
      'eslint-comments/no-duplicate-disable': 'off',
      'eslint-comments/no-unlimited-disable': 'off',
      'eslint-comments/no-unused-enable': 'off',
      'eslint-comments/require-description': 'off',
      'no-useless-assignment': 'off',
    },
  },
  wc['flat/best-practice'],
  lit['flat/recommended'],
  {
    // https://github.com/vitest-dev/vitest/issues/4543#issuecomment-1824628142
    files: ['**/src/**/*.test.ts', '**/src/**/*.spec.ts', '**/test/**/*.ts', '**/e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/class-methods-use-this': 'off',
      '@typescript-eslint/init-declarations': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/prefer-destructuring': 'off',
      '@typescript-eslint/unbound-method': 'off',
      complexity: 'off',
      'max-nested-callbacks': 'off',
      'promise/avoid-new': 'off',
    },
  },
  prettier,
)
