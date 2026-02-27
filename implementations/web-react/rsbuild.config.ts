import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      index: './src/main.tsx',
    },
    define: {
      __ENABLE_PREVIEW_PANEL__: JSON.stringify(
        process.env.PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL === 'true',
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
    port: 3001,
  },
})
