import Optimization from '@contentful/optimization-web'
import attachOptimizationPreviewPanel from './attachOptimizationPreviewPanel'

declare global {
  interface Window {
    Optimization?: typeof Optimization
  }
}

if (typeof window !== 'undefined') {
  window.Optimization ??= Optimization
  window.attachOptimizationPreviewPanel ??= attachOptimizationPreviewPanel
}
