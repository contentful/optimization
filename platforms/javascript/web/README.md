<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Optimization Web SDK</h3>

<div align="center">

[Readme](./README.md) · [Reference](https://contentful.github.io/optimization) ·
[Contributing](/CONTRIBUTING.md)

</div>

This SDK implements functionality specific to the Web environment, based on the
[Optimization Core Library](/universal/core/README.md). This SDK is part of the
[Contentful Optimization SDK Suite](/README.md).

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Getting Started](#getting-started)
- [Reference Implementations](#reference-implementations)
- [Configuration](#configuration)
  - [Top-level Configuration Options](#top-level-configuration-options)
  - [Analytics Options](#analytics-options)
  - [Event Builder Options](#event-builder-options)
  - [Fetch Options](#fetch-options)
  - [Personalization Options](#personalization-options)
- [Optimization Properties](#optimization-properties)
- [Optimization Methods](#optimization-methods)
  - [Top-level Methods](#top-level-methods)
    - [`consent`](#consent)
    - [`reset`](#reset)
    - [`startAutoTrackingEntryViews`](#startautotrackingentryviews)
    - [`stopAutoTrackingEntryViews`](#stopautotrackingentryviews)
    - [`trackEntryViewForElement`](#trackentryviewforelement)
    - [`untrackEntryViewForElement`](#untrackentryviewforelement)
  - [Personalization Data Resolution Methods](#personalization-data-resolution-methods)
    - [`getCustomFlag`](#getcustomflag)
    - [`personalizeEntry`](#personalizeentry)
    - [`getMergeTagValue`](#getmergetagvalue)
  - [Personalization and Analytics Event Methods](#personalization-and-analytics-event-methods)
    - [`identify`](#identify)
    - [`page`](#page)
    - [`track`](#track)
    - [`trackComponentView`](#trackcomponentview)
    - [`trackFlagView`](#trackflagview)
- [Entry View Tracking](#entry-view-tracking)
  - [Manual Entry View Tracking](#manual-entry-view-tracking)
  - [Automatic Entry View Tracking](#automatic-entry-view-tracking)
  - [Manual Entry Element Observation](#manual-entry-element-observation)
  - [Automatic Entry Element Observation](#automatic-entry-element-observation)

<!-- mtoc-end -->
</details>

## Getting Started

Install using an NPM-compatible package manager, pnpm for example:

```sh
pnpm install @contentful/optimization-web
```

Import the Optimization class; both CJS and ESM module systems are supported, ESM preferred:

```ts
import Optimization from '@contentful/optimization-web'
```

Configure and initialize the Optimization Node SDK:

```ts
const optimization = new Optimization({ clientId: 'abc123' })
```

## Reference Implementations

- [Web Vanilla](/implementations/web-vanilla/README.md): Example static Web page that renders and
  emits analytics events for personalized content using a vanilla JS drop-in build of the Web SDK

## Configuration

### Top-level Configuration Options

| Option                     | Required? | Default                       | Description                                                                    |
| -------------------------- | --------- | ----------------------------- | ------------------------------------------------------------------------------ |
| `allowedEventTypes`        | No        | `['identify', 'page']`        | Allow-listed event types permitted when consent is not set                     |
| `analytics`                | No        | See "Analytics Options"       | Configuration specific to the Analytics/Insights API                           |
| `app`                      | No        | `undefined`                   | The application definition used to attribute events to a specific consumer app |
| `autoTrackEntryViews`      | No        | `false`                       | Opt-in automated tracking of entry/component views                             |
| `clientId`                 | Yes       | N/A                           | The Ninetailed API Key which can be found in the Ninetailed Admin app          |
| `defaults`                 | No        | `undefined`                   | Set of default state values applied on initialization                          |
| `environment`              | No        | `'main'`                      | The Ninetailed environment configured in the Ninetailed Admin app              |
| `eventBuilder`             | No        | See "Event Builder Options"   | Event builder configuration (channel/library metadata, etc.)                   |
| `fetchOptions`             | No        | See "Fetch Options"           | Configuration for Fetch timeout and retry functionality                        |
| `getAnonymousId`           | No        | `undefined`                   | Function used to obtain an anonymous user identifier                           |
| `logLevel`                 | No        | `'error'`                     | Minimum log level for the default console sin                                  |
| `personalization`          | No        | See "Personalization Options" | Configuration specific to the Personalization/Experience API                   |
| `preventedComponentEvents` | No        | `undefined`                   | Initial duplication prevention configuration for component events              |

Configuration method signatures:

- `getAnonymousId`: `() => string | undefined`

### Analytics Options

| Option          | Required? | Default                                    | Description                                                              |
| --------------- | --------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| `baseUrl`       | No        | `'https://ingest.insights.ninetailed.co/'` | Base URL for the Insights API                                            |
| `beaconHandler` | No        | Built-in beacon API integration            | Handler used to enqueue events via the Beacon API or a similar mechanism |

Configuration method signatures:

- `beaconHandler`: `(url: string | URL, data: BatchInsightsEventArray) => boolean`

### Event Builder Options

Event builder options should only be supplied when building an SDK on top of Core or any of its
descendent SDKs.

| Option              | Required? | Default                                              | Description                                                                        |
| ------------------- | --------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `app`               | No        | `undefined`                                          | The application definition used to attribute events to a specific consumer app     |
| `channel`           | No        | `'web'`                                              | The channel that identifies where events originate from (e.g. `'web'`, `'mobile'`) |
| `library`           | No        | `{ name: 'Optimization Web API', version: '0.0.0' }` | The client library metadata that is attached to all events                         |
| `getLocale`         | No        | Built-in locale resolution                           | Function used to resolve the locale for outgoing events                            |
| `getPageProperties` | No        | Built-in page properties resolution                  | Function that returns the current page properties                                  |
| `getUserAgent`      | No        | Built-in user agent resolution                       | Function used to obtain the current user agent string when applicable              |

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

### Fetch Options

Fetch options allow for configuration of a Fetch API-compatible fetch method and the retry/timeout
logic integrated into the Optimization API Client. Specify the `fetchMethod` when the host
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

- `fetchMethod`: `(url: string | URL, init: RequestInit) => Promise<Response>`
- `onFailedAttempt` and `onRequestTimeout`: `(options: FetchMethodCallbackOptions) => void`

### Personalization Options

| Option            | Required? | Default                               | Description                                                         |
| ----------------- | --------- | ------------------------------------- | ------------------------------------------------------------------- |
| `baseUrl`         | No        | `'https://experience.ninetailed.co/'` | Base URL for the Experience API                                     |
| `enabledFeatures` | No        | `['ip-enrichment', 'location']`       | Enabled features which the API may use for each request             |
| `ip`              | No        | `undefined`                           | IP address to override the API behavior for IP analysis             |
| `locale`          | No        | `'en-US'` (in API)                    | Locale used to translate `location.city` and `location.country`     |
| `plainText`       | No        | `false`                               | Sends performance-critical endpoints in plain text                  |
| `preflight`       | No        | `false`                               | Instructs the API to aggregate a new profile state but not store it |

## Optimization Properties

- `states`: Returns an object mapping of observables for all internal states

The following observables are exposed via the `states` property:

- `consent`: The current state of user consent
- `eventStream`: The latest event to be queued
- `flags`: All current resolved Custom Flags
- `profile`: The current user profile
- `personalizations`: The current collection of selected personalizations

Each state except `consent` and `eventStream` is updated internally whenever a response from the
Experience API contains a new or updated respective state.

## Optimization Methods

Arguments marked with an asterisk (\*) are always required.

### Top-level Methods

#### `consent`

Updates the user consent state.

Arguments:

- `accept`: A boolean value specifying whether the user has accepted (`true`) or denied (`false`). A
  value of `undefined` implies that the user has not yet explicitly chosen whether to consent.

#### `reset`

Resets all internal state _except_ consent. This method expects no arguments and returns no value.

#### `startAutoTrackingEntryViews`

Starts the process of tracking entry views.

Arguments:

- `options`: Options to be passed to the element view observer:
  - `dwellTimeMs`: Required time before emitting the view event; default 1,000ms
  - `minVisibleRatio`: Minimum intersection ratio considered "visible"; default `0.1` (10%)
  - `root`: `IntersectionObserver` `root`; default `null` (viewport)
  - `rootMargin`: `IntersectionObserver` `rootMargin`; default `0px`
  - `maxRetries`: Maximum callback retry attempts on failure; default 2
  - `retryBackoffMs`: Initial back-off delay in milliseconds for retries; default 300ms
  - `backoffMultiplier`: Exponential back-off multiplier; default 2

> [!WARNING]
>
> This method is called internally when the `autoTrackEntryViews` configuration option is set to
> `true` and consent is given; do not call this method directly unless `autoTrackEntryViews` is set
> to `false`

#### `stopAutoTrackingEntryViews`

Stops and cleans up the process of tracking entry views. This method expects no arguments and
returns no value.

> [!WARNING]
>
> This method is called internally when the `autoTrackEntryViews` configuration option is set to
> `true` and consent has not been given; do not call this method directly unless
> `autoTrackEntryViews` is set to `false`

#### `trackEntryViewForElement`

Manually observes a given element for automatic entry/component tracking.

Arguments:

- `element`: A DOM element that directly contains the entry content to be tracked
- `options`\*: Per-element options used to refine observation
  - `data`: Entry-specific data to send to the `IntersectionObserver` callback; see "Entry View
    Tracking"
  - `dwellTimeMs`: Per-element override of the required time before emitting the view event
  - `maxRetries`: Per-element override of the maximum callback retry attempts on failure
  - `retryBackoffMs`: Per-element override of the initial back-off delay in milliseconds for retries
  - `backoffMultiplier`: Per-element override of the exponential back-off multiplier

> [!INFO]
>
> This method does not need to be called if the given element is auto-observable as an entry; see
> "Entry View Tracking"

#### `untrackEntryViewForElement`

Manually stops observing a given element for automatic entry/component tracking.

Arguments:

- `element`: A DOM element that directly contains entry content that is already tracked

> [!INFO]
>
> This method does not need to be called if the given element is auto-observable as an entry; see
> "Entry View Tracking"

### Personalization Data Resolution Methods

#### `getCustomFlag`

Get the specified Custom Flag's value from the provided changes array, or from the current internal
state.

Arguments:

- `name`\*: The name/key of the Custom Flag
- `changes`: Changes array

Returns:

- The resolved value for the specified Custom Flag, or `undefined` if it cannot be found.

#### `personalizeEntry`

Resolve a baseline Contentful entry to a personalized variant using the provided selected
personalizations, or from the current internal state.

Type arguments:

- `S`: Entry skeleton type
- `M`: Chain modifiers
- `L`: Locale code

Arguments:

- `entry`\*: The entry to personalize
- `personalizations`: Selected personalizations

Returns:

- The resolved personalized entry variant, or the supplied baseline entry if baseline is the
  selected variant or a variant cannot be found.

#### `getMergeTagValue`

Resolve a "Merge Tag" to a value based on the current (or provided) profile. A "Merge Tag" is a
special Rich Text fragment supported by Contentful that specifies a profile data member to be
injected into the Rich Text when rendered.

Arguments:

- `embeddedNodeEntryTarget`\*: The merge tag entry node to resolve
- `profile`: The user profile

### Personalization and Analytics Event Methods

Each method except `trackFlagView` may return an `OptimizationData` object containing:

- `changes`: Currently used for Custom Flags
- `personalizations`: Selected personalizations for the profile
- `profile`: Profile associated with the evaluated events

#### `identify`

Identify the current profile/visitor to associate traits with a profile.

Arguments:

- `payload`\*: Identify event builder arguments object, including an optional `profile` property
  with a `PartialProfile` value that requires only an `id`

#### `page`

Record a personalization page view.

Arguments:

- `payload`\*: Page view event builder arguments object, including an optional `profile` property
  with a `PartialProfile` value that requires only an `id`

#### `track`

Record a personalization custom track event.

Arguments:

- `payload`\*: Track event builder arguments object, including an optional `profile` property with a
  `PartialProfile` value that requires only an `id`

#### `trackComponentView`

Record an analytics component view event. When the payload marks the component as "sticky", an
additional personalization component view is recorded. This method only returns `OptimizationData`
when the component is marked as "sticky".

Arguments:

- `payload`\*: Component view event builder arguments object, including an optional `profile`
  property with a `PartialProfile` value that requires only an `id`
- `duplicationScope`: Arbitrary string that may be used to scope component view duplication

#### `trackFlagView`

Track a feature flag view via analytics. This is functionally the same as a non-sticky component
view event.

Arguments:

- `payload`\*: Component view event builder arguments object, including an optional `profile`
  property with a `PartialProfile` value that requires only an `id`
- `duplicationScope`: Arbitrary string that may be used to scope component view duplication

## Entry View Tracking

Tracking of entry/component views is based on the element that contains that entry's content. The
Optimization Web SDK can automatically track observed entry elements for events such as "component
views", and it can also automatically observe elements that are marked as entry-related elements.

### Manual Entry View Tracking

To manually track entry views using custom tracking code, simply call `trackComponentView` with the
necessary arguments when appropriate.

Example:

```ts
optimization.trackComponentView({ entryId: 'abc-123', ... })
```

### Automatic Entry View Tracking

Entry/component views can be tracked automatically for observed entry-related elements by simply
setting the `autoTrackEntryViews` configuration option to `true`, or by calling the
`startAutoTrackingEntryViews` method if further setup is required depending on the consumer's SDK
integration solution.

### Manual Entry Element Observation

To track an element as an entry-related element, call the `trackEntryViewForElement` method with the
element to be tracked, as well as the `data` option set with the following data members:

- `duplicationScope`: Key to differentiate between entry views when the same entry may be tracked in
  multiple locations
- `entryId`\*: The ID of the content entry to be tracked; should be the selected variant if the
  entry is personalized
- `personalizationId`: The ID of the personalization/experience entry associated with the content
  entry; only required if the entry is personalized
- `sticky`: A boolean value that marks that the current user should _always_ see this variant;
  ignored if the entry is not personalized
- `variantIndex`: The index of the selected variant; only required if the entry is personalized

Example:

```ts
optimization.trackEntryViewForElement(element, { data: { entryId: 'abc-123', ... } })
```

### Automatic Entry Element Observation

Elements that are associated to entries using the following data attributes will be automatically
detected for observation and view tracking:

- `data-ctfl-duplication-scope`: Key to differentiate between entry views when the same entry may be
  tracked in multiple locations
- `data-ctfl-entry-id`\*: The ID of the content entry to be tracked; should be the selected variant
  if the entry is personalized
- `data-ctfl-personalization-id`: The ID of the personalization/experience entry associated with the
  content entry; only required if the entry is personalized
- `data-ctfl-sticky`: A boolean value that marks that the current user should _always_ see this
  variant; ignored if the entry is not personalized
- `data-ctfl-variant-index`: The index of the selected variant; only required if the entry is
  personalized

Example:

```html
<div data-ctfl-entry-id="abc-123">Entry Content</div>
```
