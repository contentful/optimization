import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'

const ENABLE_PREVIEW_PANEL = process.env.PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL === 'true'

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      index: './src/main.tsx',
    },
    define: {
      'import.meta.env.PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL': JSON.stringify(
        ENABLE_PREVIEW_PANEL ? 'true' : 'false',
      ),
    },
  },
  html: {
    template: './index.html',
  },
  output: {
    target: 'web',
    distPath: {
      root: 'dist',
    },
  },
  server: {
    port: 3000,
  },
})
