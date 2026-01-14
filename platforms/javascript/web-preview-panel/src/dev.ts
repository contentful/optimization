import attachOptimizationPreviewPanel from './attachOptimizationPreviewPanel'

if (typeof window !== 'undefined')
  window.attachOptimizationPreviewPanel ??= attachOptimizationPreviewPanel
