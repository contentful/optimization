<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Optimization Node SDK</h3>

<div align="center">

[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes can be published at any time.

The Optimization Node SDK implements stateless server-side optimization behavior on top of the
[Optimization Core SDK](../../universal/core-sdk/README.md). Use it for server rendering, server
functions, and Node services that need request-scoped profile evaluation or event emission.

If you are integrating a Node application, start with [Getting Started](#getting-started), then use
[Integrating the Optimization Node SDK in a Node app](https://contentful.github.io/optimization/documents/Documentation.Guides.integrating-the-node-sdk-in-a-node-app.html)
for the step-by-step flow. This README keeps the package orientation and common setup options close
at hand; generated [reference documentation](https://contentful.github.io/optimization) remains the
source of truth for exported API signatures.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Getting started](#getting-started)
- [When to use this package](#when-to-use-this-package)
- [Common configuration](#common-configuration)
- [Core workflows](#core-workflows)
  - [Request-scoped events](#request-scoped-events)
  - [Content resolution](#content-resolution)
  - [Caching guidance](#caching-guidance)
- [Development harness](#development-harness)
- [Related](#related)

<!-- mtoc-end -->
</details>

## Getting started

Install using an NPM-compatible package manager, pnpm for example:

```sh
pnpm install @contentful/optimization-node
```

Import the Optimization class; both CJS and ESM module systems are supported, ESM preferred:

```ts
import ContentfulOptimization from '@contentful/optimization-node'
```

Create the SDK once per module or process, then pass request-scoped Experience options to event
methods inside each incoming request:

```ts
const optimization = new ContentfulOptimization({
  clientId: 'your-client-id',
  environment: 'main',
})

const requestOptions = { locale: 'en-US' }
const optimizationData = await optimization.page({ profile }, requestOptions)
```

## When to use this package

Use `@contentful/optimization-node` for server-side rendering, server functions, and Node services
that need stateless profile evaluation or event emission. Use the Web or React Web SDK alongside it
when browser-side consent, anonymous ID persistence, automatic interaction tracking, or live updates
are part of the same application.

## Common configuration

The Node SDK is stateless. It does not maintain consent, profile, or browser persistence state
between requests.

| Option         | Required? | Default               | Description                                                 |
| -------------- | --------- | --------------------- | ----------------------------------------------------------- |
| `clientId`     | Yes       | N/A                   | Shared API key for Experience API and Insights API requests |
| `environment`  | No        | `'main'`              | Contentful environment identifier                           |
| `api`          | No        | See API options below | Experience API and Insights API endpoint options            |
| `app`          | No        | `undefined`           | Application metadata attached to outgoing event context     |
| `fetchOptions` | No        | SDK defaults          | Fetch timeout and retry behavior                            |
| `eventBuilder` | No        | Node SDK defaults     | Event metadata overrides for SDK-layer authors              |
| `logLevel`     | No        | `'error'`             | Minimum log level for the default console sink              |

Common `api` options:

| Option              | Required? | Default                                    | Description                                      |
| ------------------- | --------- | ------------------------------------------ | ------------------------------------------------ |
| `experienceBaseUrl` | No        | `'https://experience.ninetailed.co/'`      | Base URL for the Experience API                  |
| `insightsBaseUrl`   | No        | `'https://ingest.insights.ninetailed.co/'` | Base URL for the Insights API                    |
| `enabledFeatures`   | No        | `['ip-enrichment', 'location']`            | Experience API features to apply to each request |

Request-scoped Experience options belong in the final argument to stateless event methods:

| Option      | Description                                                 |
| ----------- | ----------------------------------------------------------- |
| `ip`        | IP address override used by the Experience API              |
| `locale`    | Locale used for Experience API location labels              |
| `plainText` | Sends performance-critical Experience API endpoints as text |
| `preflight` | Aggregates a new profile state without storing it           |

Common `fetchOptions` are `fetchMethod`, `requestTimeout`, `retries`, `intervalTimeout`,
`onFailedAttempt`, and `onRequestTimeout`. Default retries intentionally apply only to HTTP `503`
responses.

For every option, callback payload, and exported type, use the generated
[Node SDK reference](https://contentful.github.io/optimization/modules/_contentful_optimization-node.html).

## Core workflows

### Request-scoped events

Build event context from the incoming request, then call `page()`, `identify()`, `screen()`,
`track()`, or sticky `trackView()` when optimization data is needed:

```ts
app.get('/products/:slug', async (req, res) => {
  const optimizationData = await optimization.page(
    {
      profile: { id: req.cookies.profileId },
      properties: { path: req.path },
    },
    { locale: req.acceptsLanguages()[0] ?? 'en-US' },
  )

  res.render('product', { optimizationData })
})
```

In stateless runtimes, Insights-backed methods require a profile for delivery. Non-sticky
`trackView`, `trackClick`, `trackHover`, and `trackFlagView` require `payload.profile.id`.

### Content resolution

Fetch Contentful entries in your application layer, then resolve variants with returned optimization
data:

```ts
const resolvedEntry = optimization.resolveOptimizedEntry(
  baselineEntry,
  optimizationData?.selectedOptimizations,
)
```

Use `getMergeTagValue()` for Contentful Rich Text merge tags and `getFlag()` for Custom Flags. The
Node SDK is stateless, so `getFlag()` does not automatically emit flag-view tracking.

### Caching guidance

Cache raw Contentful delivery payloads in your application layer, not profile-evaluated SDK event
results.

| Data or call                                                                | Cache across requests? | Reason                                                               |
| --------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------- |
| Raw Contentful entries fetched from CDA                                     | Yes                    | They are content snapshots and can be resolved per request           |
| `resolveOptimizedEntry()` and `getMergeTagValue()` results                  | Request-local only     | Results depend on the current profile and optimization data          |
| `page()`, `identify()`, `screen()`, `track()`, and sticky `trackView()`     | No                     | These calls perform side effects and return request-specific profile |
| Non-sticky `trackView()`, `trackClick()`, `trackHover()`, `trackFlagView()` | No                     | These calls emit Insights API events                                 |

The
[Node SDK integration guide](https://contentful.github.io/optimization/documents/Documentation.Guides.integrating-the-node-sdk-in-a-node-app.html)
covers request context, profile persistence, Contentful entry resolution, and hybrid Node + browser
setups in detail.

## Development harness

The package-local dev harness runs from `packages/node/node-sdk/dev/` and reads `.env` from this
package directory.

1. Start from `.env.example` and create or update `packages/node/node-sdk/.env`.
2. Prefer the repo-standard `PUBLIC_...` variable names shown in `.env.example`.
3. Start the harness from the repo root:

   ```sh
   pnpm --filter @contentful/optimization-node dev
   ```

## Related

- [Integrating the Optimization Node SDK in a Node app](https://contentful.github.io/optimization/documents/Documentation.Guides.integrating-the-node-sdk-in-a-node-app.html) -
  step-by-step server-side integration guide
- [Node SDK generated reference](https://contentful.github.io/optimization/modules/_contentful_optimization-node.html) -
  exported API reference
- [Node reference implementation](../../../implementations/node-sdk/README.md) - server-rendered
  implementation using request-scoped SDK calls
- [Node + Web reference implementation](../../../implementations/node-sdk+web-sdk/README.md) -
  hybrid SSR and browser implementation
- [Optimization Web SDK](../../web/web-sdk/README.md) - browser SDK used when the same application
  also needs client-side consent, persistence, tracking, or live updates
