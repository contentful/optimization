const path = require('path')
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */

const config = {
  resolver: {
    // Allow Metro to resolve .mjs files from packaged SDK dependencies.
    sourceExts: ['js', 'jsx', 'ts', 'tsx', 'json', 'mjs', 'cjs'],
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === 'axios') {
        return {
          filePath: path.resolve(
            __dirname,
            'node_modules/.pnpm/node_modules/axios/dist/browser/axios.cjs',
          ),
          type: 'sourceFile',
        }
      }

      return context.resolveRequest(context, moduleName, platform)
    },
  },
}

module.exports = mergeConfig(getDefaultConfig(__dirname), config)
