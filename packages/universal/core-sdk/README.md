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

Stateful runtimes own durable in-process SDK state. Stateless runtimes pass request-scoped
Experience API options as the final event-method argument:

```ts
await statelessOptimization.page(
  { profile: { id: 'profile-id' } },
  { locale: 'de-DE', preflight: false },
)
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
server-side functions. It does not store consent or profile state. Consumers pass profile and
request-scoped Experience options with each event call.

## Common configuration

Shared Core configuration:

| Option         | Required? | Default               | Description                                                 |
| -------------- | --------- | --------------------- | ----------------------------------------------------------- |
| `clientId`     | Yes       | N/A                   | Shared API key for Experience API and Insights API requests |
| `environment`  | No        | `'main'`              | Contentful environment identifier                           |
| `api`          | No        | See API options below | Experience API and Insights API endpoint options            |
| `eventBuilder` | No        | SDK-layer defaults    | Event metadata overrides for platform SDK authors           |
| `fetchOptions` | No        | SDK defaults          | Fetch timeout and retry behavior                            |
| `logLevel`     | No        | `'error'`             | Minimum log level for the default console sink              |

Stateful-only configuration:

| Option              | Required? | Default                          | Description                                                                    |
| ------------------- | --------- | -------------------------------- | ------------------------------------------------------------------------------ |
| `allowedEventTypes` | No        | `['identify', 'page', 'screen']` | Event types allowed before consent is explicitly set                           |
| `defaults`          | No        | `undefined`                      | Initial state, commonly including consent or profile values                    |
| `getAnonymousId`    | No        | `undefined`                      | Function used to provide an anonymous ID from application-owned identity state |
| `onEventBlocked`    | No        | `undefined`                      | Callback invoked when consent or guard logic blocks an event                   |
| `queuePolicy`       | No        | SDK defaults                     | Flush retry behavior and offline queue bounds                                  |

Common `api` options:

| Option              | Applies to | Default                                    | Description                                     |
| ------------------- | ---------- | ------------------------------------------ | ----------------------------------------------- |
| `experienceBaseUrl` | All        | `'https://experience.ninetailed.co/'`      | Base URL for the Experience API                 |
| `insightsBaseUrl`   | All        | `'https://ingest.insights.ninetailed.co/'` | Base URL for the Insights API                   |
| `enabledFeatures`   | All        | `['ip-enrichment', 'location']`            | Experience API features for each request        |
| `beaconHandler`     | Stateful   | `undefined`                                | Custom handler for enqueueing Insights batches  |
| `ip`                | Stateful   | `undefined`                                | IP address override for Experience API analysis |
| `locale`            | Stateful   | `'en-US'` (in API)                         | Locale used for Experience API location labels  |
| `plainText`         | Stateful   | `false`                                    | Sends performance-critical endpoints as text    |
| `preflight`         | Stateful   | `false`                                    | Aggregates a profile state without storing it   |

In stateless environments, pass `ip`, `locale`, `plainText`, and `preflight` as the final argument
to stateless event methods instead of constructor config.

Common `fetchOptions` are `fetchMethod`, `requestTimeout`, `retries`, `intervalTimeout`,
`onFailedAttempt`, and `onRequestTimeout`. Default retries intentionally apply only to HTTP `503`
responses.

For every option, callback payload, and exported type, use the generated
[Core SDK reference](https://contentful.github.io/optimization/modules/_contentful_optimization-core.html).

## Package surface

Core exposes reusable primitives for SDK layers:

| Surface                         | Purpose                                                                |
| ------------------------------- | ---------------------------------------------------------------------- |
| `CoreStateful`                  | Stateful optimization runtime for browser, mobile, and bridge SDKs     |
| `CoreStateless`                 | Stateless optimization runtime for server SDKs                         |
| Event methods                   | `identify`, `page`, `screen`, `track`, `trackView`, `trackClick`, etc. |
| Resolution helpers              | `resolveOptimizedEntry`, `getMergeTagValue`, and `getFlag`             |
| `states`                        | Stateful observable state streams                                      |
| Interceptors                    | First-party hooks for event and state lifecycle customization          |
| Queue policy and fetch helpers  | Shared retry, flush, timeout, and offline buffering behavior           |
| Signal and observable utilities | Lightweight reactive primitives used internally by stateful SDK layers |

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
