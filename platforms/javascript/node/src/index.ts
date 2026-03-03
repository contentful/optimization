/**
 * Contentful Optimization Node SDK.
 *
 * @remarks
 * Adds Node-specific defaults via the {@link Optimization} class.
 * Core and transitive API exports are available from dedicated entrypoints:
 * `@contentful/optimization-node/core-sdk`,
 * `@contentful/optimization-node/api-client`,
 * and `@contentful/optimization-node/api-schemas`.
 *
 * @packageDocumentation
 */

import Optimization from './Optimization'

export { OPTIMIZATION_NODE_SDK_NAME, OPTIMIZATION_NODE_SDK_VERSION } from './constants'
export * from './Optimization'

export default Optimization
