<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Optimization Core SDK</h3>

<div align="center">

[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes can be published at any time.

The Optimization Core SDK owns the platform-agnostic optimization state machine, event builders,
queues, resolvers, and interceptors used by the application-facing SDKs. Web, React Web, Node, React
Native, and native bridge layers build on this package.

We recommend starting application code with a platform SDK rather than Core directly. Use this
README when building or maintaining SDK layers, and use
[Choosing the right SDK](https://contentful.github.io/optimization/documents/Documentation.Guides.choosing-the-right-sdk.html)
when deciding which application-facing package belongs in an integration. Generated
[reference documentation](https://contentful.github.io/optimization) remains the source of truth for
exported API signatures.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Getting started](#getting-started)
- [When to use this package](#when-to-use-this-package)
- [Core variants](#core-variants)
  - [Stateful Core](#stateful-core)
  - [Stateless Core](#stateless-core)
- [Common configuration](#common-configuration)
- [Package surface](#package-surface)
  - [Custom entry-source adapters](#custom-entry-source-adapters)
- [Preview support](#preview-support)
- [Related](#related)

<!-- mtoc-end -->
</details>

## Getting started

Install using an NPM-compatible package manager, pnpm for example:

```sh
pnpm install @contentful/optimization-core
```

Choose the stateful or stateless Core class based on the runtime layer you are building:

```ts
import { CoreStateful, CoreStateless } from '@contentful/optimization-core'

const statefulOptimization = new CoreStateful({ clientId: 'your-client-id' })
const statelessOptimization = new CoreStateless({ clientId: 'your-client-id' })
```

Stateful runtimes own durable in-process SDK state. Stateless runtimes bind request-scoped consent,
profile state, event context, and Experience API options before calling event methods:

```ts
const requestOptimization = statelessOptimization.forRequest({
  consent: true,
  locale: 'en-US',
  eventContext: { locale: 'en-US' },
  experienceOptions: { preflight: false },
  profile: { id: 'profile-id' },
})

const { accepted, data } = await requestOptimization.page()
```

## When to use this package

Use `@contentful/optimization-core` when you are building or maintaining an SDK layer that needs the
shared optimization state machine, event builders, queueing, resolvers, or interceptors. Most
application code uses a platform SDK such as Web, React Web, Node, or React Native instead of
depending on Core directly.

## Core variants

### Stateful Core

`CoreStateful` is the basis for SDKs that run in stateful JavaScript runtimes such as browsers,
mobile JavaScript containers, and native bridge runtimes. It maintains consent, profile, selected
optimization, flag, event-stream, blocked-event, and preview-panel state as read-only observables.

> [!IMPORTANT]
>
> `CoreStateful` uses module-global state by design. Initialize exactly one stateful instance per
> JavaScript runtime and reuse it.

### Stateless Core

`CoreStateless` is the basis for SDKs that run in stateless environments such as Node servers and
server-side functions. It does not store consent or profile state between requests. Consumers call
`forRequest()` to create a request-bound event client with the consent, profile, event context, and
Experience options for that one incoming request.

## Common configuration

Shared Core configuration:

| Option         | Required? | Default               | Description                                                 |
| -------------- | --------- | --------------------- | ----------------------------------------------------------- |
| `clientId`     | Yes       | N/A                   | Shared API key for Experience API and Insights API requests |
| `environment`  | No        | `'main'`              | Contentful environment identifier                           |
| `api`          | No        | See API options below | Experience API and Insights API endpoint options            |
| `contentful`   | No        | `undefined`           | App-owned `contentful.js` client, default query, and cache  |
| `eventBuilder` | No        | SDK-layer defaults    | Event metadata overrides for platform SDK authors           |
| `fetchOptions` | No        | SDK defaults          | Fetch timeout and retry behavior                            |
| `logLevel`     | No        | `'error'`             | Minimum log level for the default console sink              |

Consent and event configuration:

| Option              | Required? | Default     | Description                                                  |
| ------------------- | --------- | ----------- | ------------------------------------------------------------ |
| `allowedEventTypes` | No        | `[]`        | Event types allowed before consent is explicitly set         |
| `onEventBlocked`    | No        | `undefined` | Callback invoked when consent or guard logic blocks an event |

Core itself fails closed before consent. Platform SDKs set runtime-specific defaults for the event
types that make sense in that runtime, such as browser `identify`/`page`, server `identify`/`page`,
and mobile `identify`/`screen`.

Stateful-only configuration:

| Option           | Required? | Default      | Description                                                                       |
| ---------------- | --------- | ------------ | --------------------------------------------------------------------------------- |
| `defaults`       | No        | `undefined`  | Initial state, commonly including consent, persistence consent, or profile values |
| `getAnonymousId` | No        | `undefined`  | Function used to provide an anonymous ID from application-owned identity state    |
| `queuePolicy`    | No        | SDK defaults | Flush retry behavior and offline queue bounds                                     |

Persistence consent controls durable profile-continuity storage for SDKs with runtime storage:
profile, anonymous ID, changes, and selected optimization caches. Event consent, stored consent
decisions, and debug state are tracked separately.

Common `api` options:

| Option              | Applies to | Default                                    | Description                                       |
| ------------------- | ---------- | ------------------------------------------ | ------------------------------------------------- |
| `experienceBaseUrl` | All        | `'https://experience.ninetailed.co/'`      | Base URL for the Experience API                   |
| `insightsBaseUrl`   | All        | `'https://ingest.insights.ninetailed.co/'` | Base URL for the Insights API                     |
| `enabledFeatures`   | All        | `['ip-enrichment', 'location']`            | Experience API features for each request          |
| `ip`                | Stateful   | `undefined`                                | IP address override for Experience API analysis   |
| `plainText`         | Stateful   | `true` for single-profile mutations        | Sends single-profile Experience mutations as text |
| `preflight`         | Stateful   | `false`                                    | Aggregates a profile state without storing it     |

When `plainText` is omitted, single-profile Experience mutation/event requests use `text/plain`.
Pass `plainText: false` to send JSON. Experience batch profile updates still default to JSON.

In stateless environments, pass `ip`, `locale`, `plainText`, and `preflight` as `experienceOptions`
when creating the request-bound client instead of constructor config. Pass request-specific Insights
API options, such as a last-chance `beacon` sender, as `insightsOptions`.

Core-backed stateful SDKs can accept an initial top-level `locale` and runtime `setLocale(locale)`
calls. They expose that SDK Experience API and default event locale through the live `locale` getter
and `states.locale` observable. Stateless server SDKs should pass the request-scoped SDK locale as
`forRequest({ locale })`; advanced callers can still pass `experienceOptions.locale` when no request
`locale` is supplied.

Applications own Contentful CDA locale selection and pass that locale directly to their Contentful
client. For the full locale model, see
[Locale handling in the Optimization SDK Suite](https://contentful.github.io/optimization/documents/Documentation.Concepts.Locale_handling_in_the_Optimization_SDK_Suite.html).

Common `fetchOptions` are `fetchMethod`, `requestTimeout`, `retries`, `intervalTimeout`,
`onFailedAttempt`, and `onRequestTimeout`. Default retries intentionally apply only to HTTP `503`
responses.

For every option, callback payload, and exported type, use the generated
[Core SDK reference](https://contentful.github.io/optimization/modules/_contentful_optimization-core.html).

## Package surface

Core exposes reusable primitives for SDK layers:

| Surface                         | Purpose                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `CoreStateful`                  | Stateful optimization runtime for browser, mobile, and bridge SDKs                |
| `CoreStateless`                 | Stateless optimization runtime for server SDKs                                    |
| Event methods                   | `identify`, `page`, `screen`, `track`, `trackView`, `trackClick`, etc.            |
| Resolution and fetch helpers    | `resolveOptimizedEntry`, `fetchOptimizedEntry`, `getMergeTagValue`, and `getFlag` |
| Current-state tracking          | `AcceptedCurrentStateTracker` for SDK-owned page or screen adapters               |
| `states`                        | Stateful observable state streams                                                 |
| Interceptors                    | First-party hooks for event and state lifecycle customization                     |
| Queue policy and fetch helpers  | Shared retry, flush, timeout, and offline buffering behavior                      |
| Signal and observable utilities | Lightweight reactive primitives used internally by stateful SDK layers            |

When a `contentful.js` client is available, prefer SDK-managed fetching. Configure
`contentful: { client, defaultQuery?, cache? }`, then call `fetchContentfulEntry(entryId, query?)`
or `fetchOptimizedEntry(entryId, options?)`. Managed calls merge `defaultQuery`, per-call query
overrides, SDK `locale` fallback, and `include: 10`, then cache entries per SDK instance by default.
Set `contentful.cache: false` to disable the cache or call `clearContentfulEntryCache()` to clear
it. `resolveOptimizedEntry()` remains the manual path for entries the app already fetched. Stateful
Core uses the current `selectedOptimizations` when omitted, request-bound stateless clients use the
latest accepted Experience selections and request `locale` fallback for managed Contentful fetches,
and root stateless callers pass explicit `selectedOptimizations`.

Do not pass all-locale CDA responses from `withAllLocales` or `locale=*`; optimization fields such
as `fields.nt_experiences` and `fields.nt_variants` must be direct single-locale field values. See
[Entry personalization and variant resolution](https://contentful.github.io/optimization/documents/Documentation.Concepts.Entry_personalization_and_variant_resolution.html#single-locale-cda-entry-contract)
for the entry contract and
[Locale handling in the Optimization SDK Suite](https://contentful.github.io/optimization/documents/Documentation.Concepts.Locale_handling_in_the_Optimization_SDK_Suite.html)
for the broader locale model.

### Custom entry-source adapters

`@contentful/optimization-core/entry-source` is an advanced subpath for custom JavaScript runtime or
framework adapters that cannot use an official Web, React Web, React Native, Node, or native SDK
surface. It is not part of the root Core API posture and is not the preferred path for application
integrations.

Import `OptimizedEntrySourceController` when an adapter accepts either a direct `baselineEntry` or
an `entryId` that must be fetched through an SDK-managed `contentful.js` client. The controller owns
the `baselineEntry` versus `entryId` source lifecycle, `entryId + entryQuery` fetch keying, SDK
readiness/loading/error snapshots, stale request protection, and `disconnect()` cleanup.
`createOptimizedEntryLoadingEntry(entryId)` creates a stable placeholder Contentful entry for
adapter loading states.

The entry-source controller does not own rendering, variant resolution, tracking, consent,
Experience API calls, or Contentful client creation. After a snapshot contains `baselineEntry`, the
adapter still calls `resolveOptimizedEntry()`, renders the result, and wires any runtime-specific
tracking.

The generated reference owns method arguments, return types, callback payload shapes, and inherited
members. Keep this README focused on package role and maintainer orientation.

## Preview support

Preview-panel helpers live under the internal [`preview-support`](./src/preview-support/README.md)
entry. They are used by first-party preview surfaces to register preview state bridges, apply
optimization overrides, and map Contentful entries for local authoring workflows.

Application code must not use preview support directly unless it is building a first-party preview
surface.

## Related

- [Choosing the right SDK](https://contentful.github.io/optimization/documents/Documentation.Guides.choosing-the-right-sdk.html) -
  package selection guidance for application integrations
- [Core SDK generated reference](https://contentful.github.io/optimization/modules/_contentful_optimization-core.html) -
  exported API reference
- [Optimization Web SDK](../../web/web-sdk/README.md) - browser SDK built on `CoreStateful`
- [Optimization Node SDK](../../node/node-sdk/README.md) - server SDK built on `CoreStateless`
- [Optimization React Native SDK](../../react-native-sdk/README.md) - mobile SDK built on
  `CoreStateful`
- [Core preview support](./src/preview-support/README.md) - internal preview helper entry
