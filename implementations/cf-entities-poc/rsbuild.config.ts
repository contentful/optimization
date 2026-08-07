import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: { index: './src/main.tsx' },
    define: {
      'import.meta.env.PUBLIC_NINETAILED_CLIENT_ID': JSON.stringify(
        process.env.PUBLIC_NINETAILED_CLIENT_ID
      ),
      'import.meta.env.PUBLIC_NINETAILED_ENVIRONMENT': JSON.stringify(
        process.env.PUBLIC_NINETAILED_ENVIRONMENT
      ),
      'import.meta.env.PUBLIC_EXPERIENCE_API_BASE_URL': JSON.stringify(
        process.env.PUBLIC_EXPERIENCE_API_BASE_URL
      ),
      'import.meta.env.PUBLIC_OPTIMIZATION_LOG_LEVEL': JSON.stringify(
        process.env.PUBLIC_OPTIMIZATION_LOG_LEVEL
      ),
      'import.meta.env.DEV': JSON.stringify(true),
    },
  },
  server: { port: 3002 },
})
