/**
 * Contentful Optimization SDK build utilities for packaging and bundling.
 *
 * @packageDocumentation
 */
export { checkBundleSize } from './bundleSize'
export type { BundleSizeFailure, BundleSizeResult, CheckBundleSizeOptions } from './bundleSize'
export { checkClientBoundaryExports } from './clientBoundaryExports'
export type {
  CheckClientBoundaryExportsOptions,
  ClientBoundaryExportFailure,
} from './clientBoundaryExports'
export { emitDualDts } from './emitDualDts'
export { getPackageName, getPackageVersion, hasPackageName, hasPackageVersion } from './package'
export { preparePublishReadme, rewriteReadmeForPublish } from './publishReadme'
export { concatPolyfills, ensureUmdDefaultExport, maybeEnableRsDoctor } from './rslib'
