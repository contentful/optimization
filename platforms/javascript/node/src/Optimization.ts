import { type App, type CoreStatelessConfig, CoreStateless } from '@contentful/optimization-core'
import { merge } from 'es-toolkit'

/**
 * Configuration for the Node-specific Optimization SDK.
 *
 * @public
 * @remarks
 * This configuration extends {@link CoreConfig} but allows partial overrides
 * of the event-builder configuration. SDKs commonly inject their own library
 * metadata or channel definitions.
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
   * This differs from {@link CoreConfig.eventBuilder}, which expects a
   * full configuration object.
   */
  eventBuilder?: Partial<Omit<CoreStatelessConfig['eventBuilder'], 'app'>>
}

/**
 * Merge user-supplied configuration with defaults for the Node SDK.
 *
 * @param config - The input configuration supplied by the caller.
 * @returns A fully composed {@link CoreConfig} object suitable for
 *          constructing the core runtime.
 *
 * @internal
 * @remarks
 * Ensures that the Node SDK always identifies itself via a `server` channel
 * and a `library` metadata block unless explicitly overridden.
 */
function mergeConfig(config: OptimizationNodeConfig): CoreStatelessConfig {
  const { app, ...restConfig } = config

  const defaultConfig: Partial<CoreStatelessConfig> = {
    eventBuilder: {
      app,
      channel: 'server',
      library: { name: 'Optimization Node API', version: '0.0.0' },
    },
  }
  return merge(defaultConfig, restConfig)
}

/**
 * Node-specific Optimization SDK built on {@link CoreStateless}.
 *
 * @public
 * @remarks
 * This class adapts the stateless Optimization Core for Node runtimes by
 * applying environment-appropriate defaults (e.g., server channel, Node SDK
 * library metadata). No analytics or personalization behavior is modified—
 * only configuration defaults differ.
 *
 * @example
 * ```ts
 * import Optimization from '@contentful/optimization-node'
 *
 * const sdk = new Optimization({
 *   clientId: 'abc-123',
 *   environment: 'main',
 *   logLevel: 'info',
 * })
 *
 * await sdk.track({ event: 'server_event', properties: { id: 1 } })
 * ```
 */
class Optimization extends CoreStateless {
  /**
   * Create an instance of the Node SDK with merged defaults.
   *
   * @param config - Partial Node-specific configuration. Any eventBuilder
   *                 fields provided are merged with Node's defaults.
   */
  constructor(config: OptimizationNodeConfig) {
    const mergedConfig: CoreStatelessConfig = mergeConfig(config)

    super(mergedConfig)
  }
}

export default Optimization
