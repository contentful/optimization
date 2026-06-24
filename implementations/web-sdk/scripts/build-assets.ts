import { cpSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dist = resolve(root, 'public/dist')

mkdirSync(dist, { recursive: true })

const resource = (...path: string[]): string => resolve(root, 'node_modules', ...path)

// Web SDK UMD bundles
cpSync(resource('@contentful/optimization-web/dist'), dist, { recursive: true })

// Preview panel UMD bundle
cpSync(
  resource(
    '@contentful/optimization-web-preview-panel/dist/contentful-optimization-web-preview-panel.umd.js',
  ),
  resolve(dist, 'contentful-optimization-web-preview-panel.umd.js'),
)

// Theme CSS from shared e2e-web package
cpSync(resource('e2e-web/src/theme.css'), resolve(dist, 'theme.css'))
