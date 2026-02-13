import { getPackageName } from 'build-tools'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig, type UserConfig } from 'vite'
import { analyzer } from 'vite-bundle-analyzer'
import tsconfigPaths from 'vite-tsconfig-paths'

/* eslint-disable @typescript-eslint/naming-convention -- standardized var names */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageName = getPackageName(__dirname, '@contentful/optimization-web')
/* eslint-enable @typescript-eslint/naming-convention -- standardized var names */

const config: UserConfig = {
  define: {
    __OPTIMIZATION_VERSION__: JSON.stringify(process.env.RELEASE_VERSION ?? '0.0.0'),
    __OPTIMIZATION_PACKAGE_NAME__: JSON.stringify(packageName),
  },
  resolve: {
    alias: {
      '@contentful/optimization-api-client': path.resolve(
        __dirname,
        '../../../universal/api-client/src/',
      ),
      '@contentful/optimization-api-schemas': path.resolve(
        __dirname,
        '../../../universal/api-schemas/src/',
      ),
      '@contentful/optimization-core': path.resolve(__dirname, '../../../universal/core/src/'),
    },
  },
  esbuild: {
    target: 'es2022',
  },
  plugins: [
    analyzer({ analyzerMode: 'static', fileName: 'analyzer', openAnalyzer: false }),
    visualizer({
      brotliSize: true,
      filename: 'dist/visualizer.html',
      gzipSize: true,
      template: 'flamegraph',
    }),
    tsconfigPaths(),
  ],
  test: {
    environment: 'happy-dom',
    include: ['**/*.test.?(c|m)[jt]s?(x)'],
    globals: true,
    coverage: {
      include: ['src/**/*'],
      reporter: ['text', 'html'],
    },
  },
}

const esm: UserConfig = {
  ...config,
  build: {
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      fileName: 'index',
    },
    rollupOptions: {
      output: [
        {
          format: 'es',
        },
        {
          format: 'cjs',
          exports: 'named',
        },
      ],
    },
    sourcemap: true,
  },
}

export default defineConfig(esm)
