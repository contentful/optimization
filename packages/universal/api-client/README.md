<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">API Client</h3>

<div align="center">

[Guides](https://contentful.github.io/optimization/documents/Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes may be published at any time.

The Contentful Optimization API Client Library provides methods for interfacing with Contentful's
Experience API and Insights API, which serve its Personalization and Analytics products.

> [!NOTE]
>
> The Experience API and Insights API are separate today, and this client provides a unified SDK
> surface for both APIs.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Getting Started](#getting-started)
- [Configuration](#configuration)
  - [Top-level Configuration Options](#top-level-configuration-options)
  - [Fetch Options](#fetch-options)
  - [Insights API Options](#insights-api-options)
  - [Experience API Options](#experience-api-options)
- [Working With the APIs](#working-with-the-apis)
  - [Experience API](#experience-api)
    - [Get Profile data](#get-profile-data)
    - [Create a New Profile](#create-a-new-profile)
    - [Update an Existing Profile](#update-an-existing-profile)
    - [Upsert a Profile](#upsert-a-profile)
    - [Upsert Many Profiles](#upsert-many-profiles)
  - [Insights API](#insights-api)
    - [Send Batch Events](#send-batch-events)
- [Event Construction](#event-construction)

<!-- mtoc-end -->
</details>

## Getting Started

Install using an NPM-compatible package manager, pnpm for example:

```sh
pnpm install @contentful/optimization-api-client
```

Import the API client; both CJS and ESM module systems are supported, ESM preferred:

```ts
import { ApiClient } from '@contentful/optimization-api-client'
```

Configure and initialize the API Client:

```ts
const client = new ApiClient({ clientId: 'abc123' })
```

## Configuration

### Top-level Configuration Options

| Option         | Required? | Default                      | Description                                                 |
| -------------- | --------- | ---------------------------- | ----------------------------------------------------------- |
| `experience`   | No        | See "Experience API Options" | Configuration specific to the Experience API                |
| `clientId`     | Yes       | N/A                          | Shared API key for Experience API and Insights API requests |
| `environment`  | No        | `'main'`                     | The environment identifier                                  |
| `fetchOptions` | No        | See "Fetch Options"          | Configuration for Fetch timeout and retry functionality     |
| `insights`     | No        | See "Insights API Options"   | Configuration specific to the Insights API                  |

### Fetch Options

Fetch options allow for configuration of both a Fetch API-compatible fetch method and the
retry/timeout logic integrated into this API client. Specify the `fetchMethod` when the host
application environment does not offer a `fetch` method that is compatible with the standard Fetch
API in its global scope.

| Option             | Required? | Default     | Description                                                           |
| ------------------ | --------- | ----------- | --------------------------------------------------------------------- |
| `fetchMethod`      | No        | `undefined` | Signature of a fetch method used by the API clients                   |
| `intervalTimeout`  | No        | `0`         | Delay (in milliseconds) between retry attempts                        |
| `onFailedAttempt`  | No        | `undefined` | Callback invoked whenever a retry attempt fails                       |
| `onRequestTimeout` | No        | `undefined` | Callback invoked when a request exceeds the configured timeout        |
| `requestTimeout`   | No        | `3000`      | Maximum time (in milliseconds) to wait for a response before aborting |
| `retries`          | No        | `1`         | Maximum number of retry attempts                                      |

Configuration method signatures:

- `fetchMethod`: `(url: string \| URL, init: RequestInit) => Promise<Response>`
- `onFailedAttempt` and `onRequestTimeout`: `(options: FetchMethodCallbackOptions) => void`

> [!NOTE]
>
> Retry behavior is intentionally fixed to HTTP `503` responses (`Service Unavailable`) for the
> default SDK transport policy. This matches current Experience API and Insights API expectations:
> `503` is treated as the transient availability signal, while other response classes are handled by
> caller logic and are intentionally not retried by default. Treat this as deliberate contract
> behavior, not a transport gap; broaden retry status handling only with an explicit API contract
> change.

### Insights API Options

| Option          | Required? | Default                                    | Description                                                              |
| --------------- | --------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| `baseUrl`       | No        | `'https://ingest.insights.ninetailed.co/'` | Base URL for the Insights API                                            |
| `beaconHandler` | No        | `undefined`                                | Handler used to enqueue events via the Beacon API or a similar mechanism |

Configuration method signatures:

- `beaconHandler`: `(url: string | URL, data: BatchInsightsEventArray) => boolean`

### Experience API Options

| Option            | Required? | Default                               | Description                                                         |
| ----------------- | --------- | ------------------------------------- | ------------------------------------------------------------------- |
| `baseUrl`         | No        | `'https://experience.ninetailed.co/'` | Base URL for the Experience API                                     |
| `enabledFeatures` | No        | `['ip-enrichment', 'location']`       | Enabled features which the API may use for each request             |
| `ip`              | No        | `undefined`                           | IP address to override the API behavior for IP analysis             |
| `locale`          | No        | `'en-US'` (in API)                    | Locale used to translate `location.city` and `location.country`     |
| `plainText`       | No        | `false`                               | Sends performance-critical endpoints in plain text                  |
| `preflight`       | No        | `false`                               | Instructs the API to aggregate a new profile state but not store it |

> [!NOTE]
>
> All options except `baseUrl` may also be provided on a per-request basis.

## Working With the APIs

### Experience API

Experience API methods are scoped to the client's `experience` member. All singular Experience API
methods return a `Promise` that resolves with the following data:

```json
{
  "profile": {
    /* User profile data */
  },
  "selectedOptimizations": [
    {
      /* Optimization/Experience API configuration for the associated profile */
    }
  ],
  "changes": [
    {
      /* Custom Flag changes associated with the evaluated profile */
    }
  ]
}
```

#### Get Profile data

```ts
const client = new ApiClient({ clientId: 'abc123' })
const { profile } = await client.experience.getProfile('profile-123', { locale: 'de-DE' })
```

#### Create a New Profile

```ts
const client = new ApiClient({ clientId: 'abc123' })
const { profile } = await client.experience.createProfile({ events: [...] }, { locale: 'de-DE' })
```

#### Update an Existing Profile

```ts
const client = new ApiClient({ clientId: 'abc123' })
const { profile } = await client.experience.updateProfile(
  {
    profileId: 'profile-123',
    events: [...],
  },
  { locale: 'de-DE' }
)
```

#### Upsert a Profile

```ts
const client = new ApiClient({ clientId: 'abc123' })
const { profile } = await client.experience.upsertProfile(
  {
    profileId,
    events: [...],
  },
  { locale: 'de-DE' }
)
```

#### Upsert Many Profiles

The `upsertManyProfiles` method returns a `Promise` that resolves with an array of user profiles.
The `events` array must contain at least one event. Each event should have an additional
`anonymousId` property set to the associated anonymous ID or profile ID.

```ts
const client = new ApiClient({ clientId: 'abc123' })
const profiles = await client.experience.upsertManyProfiles(
  {
    events: [
      {
        anonymousId: 'anon-123',
        // valid Experience API event payload fields
      },
    ],
  },
  { locale: 'de-DE' },
)
```

### Insights API

Insights API methods are scoped to the client's `insights` member. The batch send method returns a
`Promise` that resolves to `boolean`.

#### Send Batch Events

```ts
const client = new ApiClient({ clientId: 'abc123' })
await client.insights.sendBatchEvents([
  {
    profile: { id: 'abc-123', ... },
    events: [
      {
        type: 'component',
        componentId: 'hero-banner',
        componentType: 'Entry',
        variantIndex: 0,
        ...,
      },
    ],
  }
])
```

## Event Construction

Event-construction helpers (`EventBuilder`) are part of
[`@contentful/optimization-core`](../core-sdk/README.md) and environment SDKs that build on top of
it. This package focuses on API transport and request/response validation.
