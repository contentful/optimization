<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">API Client</h3>

<div align="center">

[Readme](./README.md) · [Reference](https://contentful.github.io/optimization) ·
[Contributing](/CONTRIBUTING.md)

</div>

The Contentful Optimization API Client Library provides methods for interfacing with Contentful's
Experience and Insights APIs, which serve its Personalization and Analytics products.

> [!NOTE]
>
> In the future, the Experience and Insights APIs may be combined behind an Optimization API

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Getting Started](#getting-started)
- [Configuration](#configuration)
  - [Top-level Configuration Options](#top-level-configuration-options)
  - [Fetch Options](#fetch-options)
  - [Analytics Options](#analytics-options)
  - [Personalization Options](#personalization-options)
- [Working With the APIs](#working-with-the-apis)
  - [Experience API](#experience-api)
    - [Get Profile data](#get-profile-data)
    - [Create a New Profile](#create-a-new-profile)
    - [Update an Existing Profile](#update-an-existing-profile)
    - [Upsert a Profile](#upsert-a-profile)
    - [Upsert Many Profiles](#upsert-many-profiles)
  - [Insights API](#insights-api)
    - [Send Batch Events](#send-batch-events)
- [Event Builder](#event-builder)
  - [Event Builder Configuration](#event-builder-configuration)
    - [Event Builder Configured Methods](#event-builder-configured-methods)

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

| Option            | Required? | Default                       | Description                                                           |
| ----------------- | --------- | ----------------------------- | --------------------------------------------------------------------- |
| `analytics`       | No        | See "Analytics Options"       | Configuration specific to the Analytics/Insights API                  |
| `clientId`        | Yes       | N/A                           | The Ninetailed API Key which can be found in the Ninetailed Admin app |
| `environment`     | No        | `'main'`                      | The Ninetailed environment configured in the Ninetailed Admin app     |
| `fetchOptions`    | No        | See "Fetch Options"           | Configuration for Fetch timeout and retry functionality               |
| `personalization` | No        | See "Personalization Options" | Configuration specific to the Personalization/Experience API          |

### Fetch Options

Fetch options allow for configuration of both a Fetch API-compatible fetch method and the
retry/timeout logic integrated into the Optimization API Client. Specify the `fetchMethod` when the
host application environment does not offer a `fetch` method that is compatible with the standard
Fetch API in its global scope.

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

### Analytics Options

| Option          | Required? | Default                                    | Description                                                              |
| --------------- | --------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| `baseUrl`       | No        | `'https://ingest.insights.ninetailed.co/'` | Base URL for the Insights API                                            |
| `beaconHandler` | No        | `undefined`                                | Handler used to enqueue events via the Beacon API or a similar mechanism |

Configuration method signatures:

- `beaconHandler`: `(url: string | URL, data: BatchInsightsEventArray) => boolean`

### Personalization Options

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

Experience API methods are scoped to the client's `personalization` member. All singular
personalization methods return a `Promise` that resolves with the following data:

```json
{
  "profile": {
    /* User profile data */
  },
  "personalizations": [
    {
      /* Personalization/experience configuration for the associated profile */
    }
  ],
  "changes": [
    {
      /* Similar to `personalizations` but currently used for Custom Flags */
    }
  ]
}
```

#### Get Profile data

```ts
const client = new ApiClient({ clientId: 'abc123' })
const { profile } = await client.personalization.getProfile('profile-123', { locale: 'de-DE' })
```

#### Create a New Profile

```ts
const client = new ApiClient({ clientId: 'abc123' })
const { profile } = await client.personalization.createProfile({ events: [...] }, { locale: 'de-DE' })
```

#### Update an Existing Profile

```ts
const client = new ApiClient({ clientId: 'abc123' })
const { profile } = await client.personalization.updateProfile(
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
const { profile } = await client.personalization.upsertProfile(
  {
    profileId,
    events: [...],
  },
  { locale: 'de-DE' }
)
```

#### Upsert Many Profiles

The `upsertManyProfiles` method returns a `Promise` that resolves with an array of user profiles.
Each event should have an additional `anonymousId` property set to the associated anonymous ID or
profile ID.

```ts
const client = new ApiClient({ clientId: 'abc123' })
const profiles = await client.personalization.upsertManyProfiles(
  { events: [...]},
  { locale: 'de-DE' },
)
```

### Insights API

Insights API methods are scoped to the client's `analytics` member. All analytics methods return a
`Promise` that resolves to `void` (no value).

#### Send Batch Events

```ts
const client = new ApiClient({ clientId: 'abc123' })
await client.analytics.sendBatchEvents([
  {
    profile: { id: 'abc-123', ... },
    events: [{ type: 'track', ... }],
  }
])
```

## Event Builder

The Event Builder is a helper class that assists in constructing valid events for submission to the
Experience and Insights APIs.

### Event Builder Configuration

Event Builder configuration options assist in adding contextual data to each event created by a
builder instance.

| Option              | Required? | Default                         | Description                                                                        |
| ------------------- | --------- | ------------------------------- | ---------------------------------------------------------------------------------- |
| `app`               | No        | `undefined`                     | The application definition used to attribute events to a specific consumer app     |
| `channel`           | Yes       | N/A                             | The channel that identifies where events originate from (e.g. `'web'`, `'mobile'`) |
| `library`           | Yes       | N/A                             | The client library metadata that is attached to all events                         |
| `getLocale`         | No        | `() => 'en-US'`                 | Function used to resolve the locale for outgoing events                            |
| `getPageProperties` | No        | `() => DEFAULT_PAGE_PROPERTIES` | Function that returns the current page properties                                  |
| `getUserAgent`      | No        | `() => undefined`               | Function used to obtain the current user agent string when applicable              |

The `get*` functions are most useful in stateful environments. Stateless environments should set the
related data directly via Event Builder method arguments.

The `channel` option may contain one of the following values:

- `web`
- `mobile`
- `server`

Configuration method signatures:

- `getLocale`: `() => string | undefined`
- `getPageProperties`:

  ```ts
  () => {
    path: string,
    query: Record<string, string>,
    referrer: string,
    search: string,
    title?: string,
    url: string
  }
  ```

- `getUserAgent`: `() => string | undefined`

#### Event Builder Configured Methods

- `buildComponentView`: Builds a component view event payload for a Contentful entry-based component
- `buildFlagView`: Builds a component view payload event for a Custom Flag component
- `buildIdentify`: Builds an identify event payload to associate a user ID with traits
- `buildPageView`: Builds a page view event payload
- `buildTrack`: Builds a track event payload for arbitrary user actions

See the
[Event Builder documentation](../classes/_contentful_optimization-api-client.EventBuilder.html) for
more information regarding arguments and return values.
