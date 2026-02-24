/**
 * Contentful Optimization Node SDK.
 *
 * @remarks
 * Re-exports the full public API of {@link @contentful/optimization-core} and
 * adds Node-specific defaults via the {@link Optimization} class.
 *
 * @packageDocumentation
 */

import Optimization from './Optimization'

export * from '@contentful/optimization-core'

export * from './global-constants'
export * from './Optimization'

export default Optimization
