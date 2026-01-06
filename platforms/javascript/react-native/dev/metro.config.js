const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const path = require('path')

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */

// Get the workspace root (four levels up from this file)
const workspaceRoot = path.resolve(__dirname, '../../../..')

const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
    // Allow Metro to resolve .mjs files from the platform packages
    sourceExts: ['js', 'jsx', 'ts', 'tsx', 'json', 'mjs', 'cjs'],
    // Resolve to browser versions of packages for React Native
    resolveRequest: (context, moduleName, platform) => {
      // Resolve workspace packages to their source files instead of dist
      const workspacePackages = {
        '@contentful/optimization-core': path.resolve(workspaceRoot, 'universal/core/src/index.ts'),
        '@contentful/optimization-api-client': path.resolve(
          workspaceRoot,
          'universal/api-client/src/index.ts',
        ),
        '@contentful/optimization-api-schemas': path.resolve(
          workspaceRoot,
          'universal/api-schemas/src/index.ts',
        ),
        '@contentful/optimization-react-native': path.resolve(
          workspaceRoot,
          'platforms/javascript/react-native/src/index.ts',
        ),
        '@contentful/optimization-react-native-preview-panel': path.resolve(
          workspaceRoot,
          'platforms/javascript/react-native-preview-panel/src/index.ts',
        ),
      }

      if (workspacePackages[moduleName]) {
        return {
          filePath: workspacePackages[moduleName],
          type: 'sourceFile',
        }
      }

      // Use browser version of diary package (no Node.js dependencies)
      if (moduleName === 'diary') {
        return {
          filePath: path.resolve(
            workspaceRoot,
            'node_modules/.pnpm/diary@0.4.5/node_modules/diary/browser.js',
          ),
          type: 'sourceFile',
        }
      }
      // Let Metro handle everything else
      return context.resolveRequest(context, moduleName, platform)
    },
  },
}

module.exports = mergeConfig(getDefaultConfig(__dirname), config)
