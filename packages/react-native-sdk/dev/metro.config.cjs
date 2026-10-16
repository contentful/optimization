const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const path = require('path')

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */

// Get the workspace root (three levels up from this file)
const workspaceRoot = path.resolve(__dirname, '../../../')
// Get the React Native package directory (one level up from dev)
const reactNativePackageDir = path.resolve(__dirname, '..')

const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(reactNativePackageDir, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
    // Allow Metro to resolve .mjs files from the platform packages
    sourceExts: ['js', 'jsx', 'ts', 'tsx', 'json', 'mjs', 'cjs'],
    // Resolve to browser versions of packages for React Native
    resolveRequest: (context, moduleName, platform) => {
      // Resolve workspace packages to their source files instead of dist
      const workspacePackages = {
        '@contentful/optimization-core': 'packages/universal/core-sdk/src',
        '@contentful/optimization-api-client': 'packages/universal/api-client/src',
        '@contentful/optimization-api-schemas': 'packages/universal/api-schemas/src',
        '@contentful/optimization-react-native': 'packages/react-native-sdk/src',
      }
      const packageName = Object.keys(workspacePackages).find(
        (name) => moduleName === name || moduleName.startsWith(`${name}/`),
      )
      if (packageName) {
        const subpath = moduleName.slice(packageName.length).replace(/^\//, '') || 'index'
        const source = path.resolve(workspaceRoot, workspacePackages[packageName], subpath)
        return context.resolveRequest(context, source, platform)
      }

      // Let Metro handle everything else
      return context.resolveRequest(context, moduleName, platform)
    },
  },
}

module.exports = mergeConfig(getDefaultConfig(__dirname), config)
