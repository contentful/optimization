/**
 * Contentful ContentfulOptimization Node SDK.
 *
 * @remarks
 * Adds Node-specific defaults via the {@link ContentfulOptimization} class.
 * Core and transitive API exports are available from dedicated entrypoints:
 * `@contentful/optimization-node/core-sdk`,
 * `@contentful/optimization-node/api-client`,
 * and `@contentful/optimization-node/api-schemas`.
 *
 * @packageDocumentation
 */

import ContentfulOptimization from './ContentfulOptimization'

export { OPTIMIZATION_NODE_SDK_NAME, OPTIMIZATION_NODE_SDK_VERSION } from './constants'
export * from './ContentfulOptimization'

export default ContentfulOptimization
