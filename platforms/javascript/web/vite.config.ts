import { resolve } from 'node:path'
import { visualizer } from 'rollup-plugin-visualizer'
import { analyzer } from 'vite-bundle-analyzer'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@contentful/optimization-core': resolve(__dirname, '../core/src/'),
    },
  },
  build: {
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Optimization',
      fileName: 'index',
    },
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
})
