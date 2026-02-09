import { resolve } from 'node:path'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig, type UserConfig } from 'vite'
import { analyzer } from 'vite-bundle-analyzer'
import umdFormatResolver from 'vite-plugin-resolve-umd-format'
import tsconfigPaths from 'vite-tsconfig-paths'

const config: UserConfig = {
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
      '@contentful/optimization-core': resolve(__dirname, '../../../universal/core/src/'),
      '@contentful/optimization-web': resolve(__dirname, '../web/src/'),
    },
  },
  esbuild: {
    target: 'es2022',
  },
  plugins: [
    analyzer({ analyzerMode: 'static', fileName: 'analyzer', openAnalyzer: false }),
    umdFormatResolver(),
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

const umd: UserConfig = {
  ...config,
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/attachOptimizationPreviewPanel.ts'),
      formats: ['umd'],
      fileName: 'contentful-optimization-web-preview-panel',
      name: 'attachOptimizationPreviewPanel',
    },
    sourcemap: true,
  },
}

export default defineConfig(umd)
