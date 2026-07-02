import type CoreStateful from '../CoreStateful'

/**
 * Members of the stateful core surface consumed by framework layers (React,
 * Angular, etc.) that must also be satisfiable by a request-scoped, read-only
 * server runtime.
 *
 * @internal
 */
type OptimizationRuntimeMembers =
  // Pure, environment-agnostic resolvers.
  | 'resolveOptimizedEntry'
  | 'getMergeTagValue'
  | 'getFlag'
  // Read surface.
  | 'states'
  | 'locale'
  | 'hasConsent'
  // Event actions (inert server-side).
  | 'identify'
  | 'page'
  | 'screen'
  | 'track'
  | 'trackView'
  | 'trackClick'
  | 'trackHover'
  | 'trackFlagView'
  // State + lifecycle actions (inert server-side).
  | 'consent'
  | 'reset'
  | 'flush'
  | 'setLocale'
  | 'destroy'

/**
 * Runtime contract shared by the client-side stateful core and any server-side
 * snapshot runtime.
 *
 * @remarks
 * The interface is derived from {@link CoreStateful} with {@link https://www.typescriptlang.org/docs/handbook/utility-types.html#picktype-keys | Pick},
 * so the browser SDK satisfies it by construction and a server implementation
 * (see `createSnapshotRuntime`) is forced to match the exact same signatures.
 * This is the single seam a framework provider binds to: it renders children
 * from either backing without branching on environment.
 *
 * The three capability tiers behave differently by environment:
 *
 * - **Resolve** (`resolveOptimizedEntry`, `getMergeTagValue`, `getFlag`) — pure
 *   functions; identical on server and client.
 * - **Read** (`states`) — live signals on the client; static, request-scoped
 *   observables on the server.
 * - **Actions** (`identify`, `page`, `screen`, `track`, `consent`, `reset`,
 *   `flush`, `setLocale`) — real side effects on the client; inert no-ops on the
 *   server, where there is no user interaction to track.
 *
 * @public
 */
export interface OptimizationRuntime extends Pick<CoreStateful, OptimizationRuntimeMembers> {}
