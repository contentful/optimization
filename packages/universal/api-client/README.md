<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">API Client</h3>

<div align="center">

[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes can be published at any time.

The Contentful Optimization API Client provides low-level transport for the Experience API and
Insights API. Application-facing SDKs compose this package with event builders, state management,
queueing, and runtime-specific defaults.

We recommend starting applications with Web, React Web, Node, or React Native SDKs. Use this package
directly when building or maintaining SDK layers, tests, tooling, or first-party integrations that
need raw API access.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Getting started](#getting-started)
- [When to use this package](#when-to-use-this-package)
- [Common configuration](#common-configuration)
- [API surface](#api-surface)
  - [Experience API](#experience-api)
  - [Insights API](#insights-api)
  - [Fetch helpers](#fetch-helpers)
- [Related](#related)

<!-- mtoc-end -->
</details>

## Getting started

Install using an NPM-compatible package manager, pnpm for example:

```sh
pnpm install @contentful/optimization-api-client
```

Import and initialize the unified API client; both CJS and ESM module systems are supported, ESM
preferred:

```ts
import { ApiClient } from '@contentful/optimization-api-client'

const client = new ApiClient({
  clientId: 'your-client-id',
  environment: 'main',
})
```

## When to use this package

Use `@contentful/optimization-api-client` when you need direct low-level access to the Experience
API or Insights API transport surface. Use an application-facing SDK when you need optimization
state, consent handling, event builders, entry resolution, tracking, or platform defaults.

## Common configuration

| Option         | Required? | Default                      | Description                                                 |
| -------------- | --------- | ---------------------------- | ----------------------------------------------------------- |
| `clientId`     | Yes       | N/A                          | Shared API key for Experience API and Insights API requests |
| `environment`  | No        | `'main'`                     | Contentful environment identifier                           |
| `experience`   | No        | See Experience options below | Experience API endpoint and default request options         |
| `insights`     | No        | See Insights options below   | Insights API endpoint options                               |
| `fetchOptions` | No        | SDK defaults                 | Fetch timeout and retry behavior                            |

Common Experience API options:

| Option            | Required? | Default                               | Description                                     |
| ----------------- | --------- | ------------------------------------- | ----------------------------------------------- |
| `baseUrl`         | No        | `'https://experience.ninetailed.co/'` | Base URL for the Experience API                 |
| `enabledFeatures` | No        | `['ip-enrichment', 'location']`       | Experience API features for each request        |
| `ip`              | No        | `undefined`                           | IP address override for Experience API analysis |
| `locale`          | No        | `'en-US'` (in API)                    | Locale used for Experience API location labels  |
| `plainText`       | No        | `false`                               | Sends performance-critical endpoints as text    |
| `preflight`       | No        | `false`                               | Aggregates a profile state without storing it   |

All Experience options except `baseUrl` can also be provided per request.

Common Insights API options:

| Option          | Required? | Default                                    | Description                                           |
| --------------- | --------- | ------------------------------------------ | ----------------------------------------------------- |
| `baseUrl`       | No        | `'https://ingest.insights.ninetailed.co/'` | Base URL for the Insights API                         |
| `beaconHandler` | No        | `undefined`                                | Custom handler for enqueueing event batches if needed |

Common `fetchOptions` are `fetchMethod`, `requestTimeout`, `retries`, `intervalTimeout`,
`onFailedAttempt`, and `onRequestTimeout`. Default retries intentionally apply only to HTTP `503`
responses.

For every option, callback payload, request type, and response type, use the generated
[API Client reference](https://contentful.github.io/optimization/modules/_contentful_optimization-api-client.html).

## API surface

### Experience API

Experience API methods are scoped to `client.experience` and return profile and optimization data:

```ts
const { profile, selectedOptimizations, changes } = await client.experience.upsertProfile(
  {
    profileId: 'profile-id',
    events: [pageEvent],
  },
  { locale: 'de-DE' },
)
```

Common methods include `getProfile`, `createProfile`, `updateProfile`, `upsertProfile`, and
`upsertManyProfiles`.

### Insights API

Insights API methods are scoped to `client.insights` and send analytics event batches:

```ts
await client.insights.sendBatchEvents({
  profile,
  events: [viewEvent],
})
```

Insights endpoints do not return response data.

### Fetch helpers

This package also exports fetch helper functions used by SDK layers:

| Helper                       | Purpose                                                 |
| ---------------------------- | ------------------------------------------------------- |
| `createProtectedFetchMethod` | Adds timeout and retry protection around a fetch method |
| `createRetryFetchMethod`     | Applies retry policy to retryable responses             |
| `createTimeoutFetchMethod`   | Aborts requests after the configured timeout            |

Use generated reference docs for helper signatures and callback payloads.

## Related

- [API Client generated reference](https://contentful.github.io/optimization/modules/_contentful_optimization-api-client.html) -
  exported API reference
- [API Schemas](../api-schemas/README.md) - runtime validation schemas and inferred API types
- [Optimization Core SDK](../core-sdk/README.md) - platform-agnostic SDK layer that composes this
  client
- [Choosing the right SDK](https://contentful.github.io/optimization/documents/Documentation.Guides.choosing-the-right-sdk.html) -
  package selection guidance for application integrations
