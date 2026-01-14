import { resolve } from 'node:path'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig, searchForWorkspaceRoot, type UserConfig } from 'vite'
import { analyzer } from 'vite-bundle-analyzer'
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
      'optimization/dev': resolve(__dirname, '../web/src/dev.ts'),
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
  server: {
    fs: {
      // Vite restricts files served via /@fs/. Keep the default workspace-root
      // behavior and add the sibling package explicitly.
      // When `server.fs.allow` is set, auto workspace detection is disabled,
      // so `searchForWorkspaceRoot()` preserves the default behavior.
      allow: [searchForWorkspaceRoot(process.cwd()), resolve(__dirname, '../web')],
    },
  },
}

const esm: UserConfig = {
  ...config,
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: 'index',
    },
    sourcemap: true,
  },
}

export default defineConfig(esm)
