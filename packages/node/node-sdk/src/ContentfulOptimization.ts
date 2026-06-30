import {
  CoreStateless,
  type CoreStatelessConfig,
  type EventType,
} from '@contentful/optimization-core'
import type { App } from '@contentful/optimization-core/api-schemas'
import { OPTIMIZATION_NODE_SDK_NAME, OPTIMIZATION_NODE_SDK_VERSION } from './constants'

const DEFAULT_NODE_ALLOWED_EVENT_TYPES: EventType[] = ['identify', 'page']

/**
 * Public Node event-builder overrides accepted by {@link OptimizationNodeConfig.eventBuilder}.
 *
 * @remarks
 * Request-scoped consent is bound with {@link ContentfulOptimization.forRequest}, so `getConsent`
 * is intentionally omitted from singleton SDK configuration.
 *
 * @public
 */
export type PublicNodeEventBuilderConfig = Partial<
  Omit<NonNullable<CoreStatelessConfig['eventBuilder']>, 'app' | 'getConsent'>
>

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
   * Request-scoped consent should be bound with `forRequest()`, not configured
   * on the SDK singleton.
   *
   * This differs from {@link CoreStatelessConfig} eventBuilder, which expects
   * a full configuration object.
   */
  eventBuilder?: PublicNodeEventBuilderConfig
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
 * const requestOptimization = sdk.forRequest({
 *   consent: true,
 *   locale: 'fr-CA',
 *   profile: { id: 'profile-id' },
 * })
 *
 * const { accepted, data } = await requestOptimization.page()
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
  constructor({ app, allowedEventTypes, eventBuilder, ...config }: OptimizationNodeConfig) {
    const { library, ...eventBuilderConfig } = eventBuilder ?? {}

    super({
      ...config,
      allowedEventTypes: allowedEventTypes ?? DEFAULT_NODE_ALLOWED_EVENT_TYPES,
      eventBuilder: {
        app,
        channel: 'server',
        ...eventBuilderConfig,
        library: {
          name: OPTIMIZATION_NODE_SDK_NAME,
          version: OPTIMIZATION_NODE_SDK_VERSION,
          ...library,
        },
        getConsent: () => false,
      },
    })
  }
}

export default ContentfulOptimization
