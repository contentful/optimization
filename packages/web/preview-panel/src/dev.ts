import ContentfulOptimization from '@contentful/optimization-web'
import attachOptimizationPreviewPanel from './attachOptimizationPreviewPanel'

declare global {
  interface Window {
    ContentfulOptimization?: typeof ContentfulOptimization
  }
}

if (typeof window !== 'undefined') {
  window.ContentfulOptimization ??= ContentfulOptimization
  window.attachOptimizationPreviewPanel ??= attachOptimizationPreviewPanel
}
