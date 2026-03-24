import type ContentfulOptimization from '@contentful/optimization-web'
import '@rsbuild/core/types'

declare global {
  interface Window {
    contentfulOptimization?: ContentfulOptimization
  }
}
