import { CoreStateless } from '@contentful/optimization-core'
import type { App } from '@contentful/optimization-core/api-schemas'
import { merge } from 'es-toolkit'
import { OPTIMIZATION_NODE_SDK_NAME, OPTIMIZATION_NODE_SDK_VERSION } from './constants'

type CoreStatelessConfig = ConstructorParameters<typeof CoreStateless>[0]

/**
 * Configuration for the Node-specific ContentfulOptimization SDK.
 *
 * @remarks
 * This configuration extends {@link CoreStatelessConfig} but allows partial
 * overrides of the event-builder configuration. SDKs commonly inject their own
 * library metadata or channel definitions.
 *
 * @see {@link CoreStatelessConfig}
 *
 * @public
 */
export interface OptimizationNodeConfig extends Omit<CoreStatelessConfig, 'eventBuilder'> {
  /**
   * The application definition used to attribute events to a specific consumer app.
   *
   * @remarks
   * When not provided, events will not contain app metadata in their context.
   */
  app?: App

  /**
   * Partial overrides for the event builder configuration.
   *
   * @remarks
   * Any provided fields are merged with the default Node SDK metadata.
   * This differs from {@link CoreStatelessConfig} eventBuilder, which expects
   * a full configuration object.
   */
  eventBuilder?: Partial<Omit<CoreStatelessConfig['eventBuilder'], 'app'>>
}

/**
 * Merge user-supplied configuration with defaults for the Node SDK.
 *
 * @param config - The input configuration supplied by the caller.
 * @returns A fully composed {@link CoreStatelessConfig} object suitable for
 *          constructing the core runtime.
 *
 * @remarks
 * Ensures that the Node SDK always identifies itself via a `server` channel
 * and a `library` metadata block unless explicitly overridden.
 *
 * @internal
 */
function mergeConfig(config: OptimizationNodeConfig): CoreStatelessConfig {
  const { app, ...restConfig } = config

  const defaultConfig: Partial<CoreStatelessConfig> = {
    eventBuilder: {
      app,
      channel: 'server',
      library: { name: OPTIMIZATION_NODE_SDK_NAME, version: OPTIMIZATION_NODE_SDK_VERSION },
    },
  }
  return merge(defaultConfig, restConfig)
}

/**
 * Node-specific ContentfulOptimization SDK built on {@link CoreStateless}.
 *
 * @remarks
 * This class adapts the stateless ContentfulOptimization Core for Node runtimes by
 * applying environment-appropriate defaults (e.g., server channel, Node SDK
 * library metadata). No core runtime behavior is modified; only configuration
 * defaults differ.
 *
 * @example
 * ```ts
 * import ContentfulOptimization from '@contentful/optimization-node'
 *
 * const sdk = new ContentfulOptimization({
 *   clientId: 'abc-123',
 *   environment: 'main',
 *   logLevel: 'info',
 * })
 *
 * const requestOptions = { locale: 'en-US' }
 *
 * await sdk.track({ event: 'server_event', properties: { id: 1 } }, requestOptions)
 * ```
 *
 * @see {@link CoreStateless}
 *
 * @public
 */
class ContentfulOptimization extends CoreStateless {
  /**
   * Create an instance of the Node SDK with merged defaults.
   *
   * @param config - Partial Node-specific configuration. Any eventBuilder
   *                 fields provided are merged with Node's defaults.
   *
   * @example
   * ```ts
   * import ContentfulOptimization from '@contentful/optimization-node'
   *
   * const optimization = new ContentfulOptimization({ clientId: 'my-client-id' })
   * ```
   */
  constructor(config: OptimizationNodeConfig) {
    const mergedConfig: CoreStatelessConfig = mergeConfig(config)

    super(mergedConfig)
  }
}

export default ContentfulOptimization
