import ContentfulOptimization from '../src/ContentfulOptimization'
import { defineContentfulOptimizationElements } from '../src/web-components'

if (typeof window !== 'undefined') {
  window.ContentfulOptimization ??= ContentfulOptimization
  Object.assign(window, {
    ContentfulOptimizationWebComponents: { defineContentfulOptimizationElements },
  })
}
