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
const url: URL = new URL('.', import.meta.url)
const { pathname: tsconfigRootDir } = url

export default defineConfig(
  {
    ignores: [
      '**/*.{js,jsx,cjs,mjs}',
      '**/.bundle/**',
      '**/.rslib',
      '**/.rstack',
      '**/android/**',
      '**/build/**',
      '**/coverage',
      '**/contentful-generated.d.ts',
      '**/dist',
      'site/media/**',
      '**/ios/**',
      // Engine-targeted JS bridge glue compiled into the native SDKs; consolidated
      // from the ios/android bridge packages, which were ignored under the rules above.
      '**/optimization-js-bridge/**',
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
      // Reassess after compile-time checks stop using `void` to consume values.
      '@typescript-eslint/no-meaningless-void-operator': 'off',
      // Reassess after explicit boundary assertions are migrated or removed.
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      // Reassess after existing default-assignment patterns are simplified.
      '@typescript-eslint/no-useless-default-assignment': 'off',
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
      // Reassess after callbacks that intentionally return values are normalized.
      '@typescript-eslint/strict-void-return': 'off',
      // Reassess after intentional loose null comparisons are rewritten.
      eqeqeq: 'off',
      // Reassess after unpaired directive blocks are migrated to scoped comments.
      '@eslint-community/eslint-comments/disable-enable-pair': 'off',
      // Reassess after aggregated enable directives are split by rule.
      '@eslint-community/eslint-comments/no-aggregating-enable': 'off',
      // Reassess after overlapping directive comments are consolidated.
      '@eslint-community/eslint-comments/no-duplicate-disable': 'off',
      // Reassess after generated and framework-owned files use scoped directives.
      '@eslint-community/eslint-comments/no-unlimited-disable': 'off',
      // Reassess after legacy enable directives are paired or removed.
      '@eslint-community/eslint-comments/no-unused-enable': 'off',
      // Reassess after all existing directive comments include descriptions.
      '@eslint-community/eslint-comments/require-description': 'off',
      // Reassess after sequential async workflows are made explicit helpers.
      'no-await-in-loop': 'off',
      // Reassess after the existing chained assignment is expanded.
      'no-multi-assign': 'off',
      // Reassess after existing negated guard branches are normalized.
      'no-negated-condition': 'off',
      // Reassess after state-machine and reducer parameter mutation is removed.
      'no-param-reassign': 'off',
      // Reassess after counter increments use assignment expressions.
      'no-plusplus': 'off',
      // Reassess after test promise executors stop returning callback results.
      'no-promise-executor-return': 'off',
      'no-useless-assignment': 'off',
      // Reassess after positional regular-expression consumers are migrated.
      'prefer-named-capture-group': 'off',
      // Reassess after compatibility-oriented ownership checks are modernized.
      'prefer-object-has-own': 'off',
      // Reassess after generated and diagnostic string assembly is modernized.
      'prefer-template': 'off',
      // Reassess after two-argument promise handlers are refactored.
      'promise/prefer-catch': 'off',
      // Reassess after flagged async state transitions receive lifecycle review.
      'require-atomic-updates': 'off',
      // Reassess after regular-expression runtime compatibility is audited.
      'require-unicode-regexp': 'off',
    },
  },
  wc['flat/best-practice'],
  lit['flat/recommended'],
  {
    // https://github.com/vitest-dev/vitest/issues/4543#issuecomment-1824628142
    files: [
      '**/src/**/*.test.ts',
      '**/src/**/*.test.tsx',
      '**/src/**/*.spec.ts',
      '**/src/**/*.spec.tsx',
      '**/test/**/*.ts',
      '**/test/**/*.tsx',
      '**/__tests__/**/*.ts',
      '**/__tests__/**/*.tsx',
      '**/e2e/**/*.ts',
      '**/e2e/**/*.tsx',
    ],
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
      'max-lines': 'off',
      'max-nested-callbacks': 'off',
      'promise/avoid-new': 'off',
    },
  },
  prettier,
)
