/**
 * Contentful Optimization SDK build utilities for packaging and bundling.
 *
 * @packageDocumentation
 */
export { checkBundleSize } from './bundleSize'
export type { BundleSizeFailure, BundleSizeResult, CheckBundleSizeOptions } from './bundleSize'
export { emitDualDts } from './emitDualDts'
export { getPackageName, hasPackageName } from './package'
export { ensureUmdDefaultExport, maybeEnableRsDoctor } from './rslib'
