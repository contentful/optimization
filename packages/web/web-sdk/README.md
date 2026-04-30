<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Optimization Web SDK</h3>

<div align="center">

[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes may be published at any time.

This SDK implements browser-specific optimization behavior on top of the
[Optimization Core SDK](../../universal/core-sdk/README.md). Use it directly for non-React browser
applications, framework adapters, and client-side runtimes that need consent state, anonymous ID
persistence, automatic entry interaction tracking, and browser-side event delivery.

If you are integrating a browser application, start with [Getting Started](#getting-started), then
use
[Integrating the Optimization Web SDK in a Web App](https://contentful.github.io/optimization/documents/Documentation.Guides.integrating-the-web-sdk-in-a-web-app.html)
for the step-by-step flow. This README keeps the package orientation and common setup options close
at hand; generated [reference documentation](https://contentful.github.io/optimization) remains the
source of truth for exported API signatures.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Getting Started](#getting-started)
  - [Usage in Vanilla JS Web Pages](#usage-in-vanilla-js-web-pages)
- [When to Use This Package](#when-to-use-this-package)
- [Common Configuration](#common-configuration)
- [Core Workflows](#core-workflows)
  - [Consent and Profile Events](#consent-and-profile-events)
  - [Content Resolution](#content-resolution)
  - [Entry Interaction Tracking](#entry-interaction-tracking)
  - [State Subscriptions](#state-subscriptions)
- [Runtime Notes](#runtime-notes)
- [Related](#related)

<!-- mtoc-end -->
</details>

## Getting Started

Install using an NPM-compatible package manager, pnpm for example:

```sh
pnpm install @contentful/optimization-web
```

Import the Optimization class; both CJS and ESM module systems are supported, ESM preferred:

```ts
import ContentfulOptimization from '@contentful/optimization-web'
```

Configure and initialize the Optimization Web SDK once per page runtime:

```ts
const optimization = new ContentfulOptimization({
  clientId: 'your-client-id',
  environment: 'main',
})
```

> [!IMPORTANT]
>
> Initialize the Web SDK once per page runtime. Reuse `window.contentfulOptimization` or your own
> singleton container binding instead of creating additional instances.

### Usage in Vanilla JS Web Pages

The UMD build is available for HTML pages that do not use a bundler:

```html
<script src="https://cdn.jsdelivr.net/npm/@contentful/optimization-web@latest/dist/contentful-optimization-web.umd.js"></script>
<script>
  window.contentfulOptimization = new ContentfulOptimization({
    clientId: 'your-client-id',
    environment: 'main',
  })
</script>
```

## When to Use This Package

Use `@contentful/optimization-web` for browser applications that need the stateful Web runtime
directly, including consent state, anonymous ID persistence, automatic entry interaction tracking,
and browser-side event delivery.

React applications should usually start with
[`@contentful/optimization-react-web`](../frameworks/react-web-sdk/README.md), which wraps this SDK
with React providers, hooks, router adapters, and entry-rendering primitives.

## Common Configuration

The Web SDK communicates with the Experience API for profile and optimization selection, and with
the Insights API for event ingestion.

| Option                      | Required? | Default                                          | Description                                                                    |
| --------------------------- | --------- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| `clientId`                  | Yes       | N/A                                              | Shared API key for Experience API and Insights API requests                    |
| `environment`               | No        | `'main'`                                         | Contentful environment identifier                                              |
| `api`                       | No        | See API options below                            | Experience API and Insights API endpoint and request options                   |
| `app`                       | No        | `undefined`                                      | Application metadata attached to outgoing event context                        |
| `defaults`                  | No        | `undefined`                                      | Initial state, commonly including consent or profile values                    |
| `allowedEventTypes`         | No        | `['identify', 'page']`                           | Event types allowed before consent is explicitly set                           |
| `autoTrackEntryInteraction` | No        | `{ views: false, clicks: false, hovers: false }` | Opt-in automatic tracking for entry views, clicks, and hovers                  |
| `cookie`                    | No        | `{ domain: undefined, expires: 365 }`            | Anonymous ID cookie settings                                                   |
| `getAnonymousId`            | No        | `undefined`                                      | Function used to provide an anonymous ID from application-owned identity state |
| `queuePolicy`               | No        | SDK defaults                                     | Flush retry behavior and offline queue bounds                                  |
| `logLevel`                  | No        | `'error'`                                        | Minimum log level for the default console sink                                 |
| `onEventBlocked`            | No        | `undefined`                                      | Callback invoked when consent or guard logic blocks an event                   |

Common `api` options:

| Option              | Required? | Default                                    | Description                                                       |
| ------------------- | --------- | ------------------------------------------ | ----------------------------------------------------------------- |
| `experienceBaseUrl` | No        | `'https://experience.ninetailed.co/'`      | Base URL for the Experience API                                   |
| `insightsBaseUrl`   | No        | `'https://ingest.insights.ninetailed.co/'` | Base URL for the Insights API                                     |
| `locale`            | No        | `'en-US'` (in API)                         | Locale used for Experience API location labels                    |
| `enabledFeatures`   | No        | `['ip-enrichment', 'location']`            | Experience API features to apply to each request                  |
| `preflight`         | No        | `false`                                    | Aggregate a new profile state without storing it                  |
| `beaconHandler`     | No        | Built-in beacon integration                | Custom handler for enqueueing Insights API batches when needed    |
| `plainText`         | No        | `false`                                    | Sends performance-critical Experience API endpoints as plain text |

Common `fetchOptions` are `fetchMethod`, `requestTimeout`, `retries`, `intervalTimeout`,
`onFailedAttempt`, and `onRequestTimeout`. Default retries intentionally apply only to HTTP `503`
responses.

For every option, callback payload, and exported type, use the generated
[Web SDK reference](https://contentful.github.io/optimization/modules/_contentful_optimization-web.html).

## Core Workflows

### Consent and Profile Events

Consent is application policy. The SDK stores the consent state and blocks non-allowed events until
consent is accepted.

```ts
optimization.consent(true)

const data = await optimization.page({
  properties: { path: window.location.pathname },
})
```

`page()`, `identify()`, `screen()`, `track()`, and sticky `trackView()` calls can return
optimization data containing `profile`, `selectedOptimizations`, and `changes`.

### Content Resolution

Fetch Contentful entries in your application layer, then use the SDK to resolve the selected
variant:

```ts
const optimizationData = await optimization.page({ properties: { path: location.pathname } })
const resolvedEntry = optimization.resolveOptimizedEntry(
  baselineEntry,
  optimizationData?.selectedOptimizations,
)
```

Use `getMergeTagValue()` for Contentful Rich Text merge tags and `getFlag()` for Custom Flags. The
Web SDK is stateful, so reading a flag also emits flag-view tracking.

### Entry Interaction Tracking

Enable automatic tracking when entry elements follow the standard data-attribute pattern:

```ts
const optimization = new ContentfulOptimization({
  clientId: 'your-client-id',
  autoTrackEntryInteraction: { views: true, clicks: true, hovers: false },
})
```

Use manual element overrides when the DOM structure does not fit automatic observation:

```ts
optimization.tracking.enableElement('views', element, {
  data: {
    componentId: 'entry-id',
    experienceId: 'experience-id',
    variantIndex: 0,
  },
})
```

For detection thresholds, data attributes, click and hover behavior, and manual overrides, use the
[Web SDK integration guide](https://contentful.github.io/optimization/documents/Documentation.Guides.integrating-the-web-sdk-in-a-web-app.html#7-track-entry-interactions-and-follow-up-events).

### State Subscriptions

The stateful Web SDK exposes observable state for UI feedback and integration glue:

```ts
const unsubscribe = optimization.states.profile.subscribe((profile) => {
  console.log(profile?.id)
})
```

Common state streams include `consent`, `profile`, `selectedOptimizations`, `changes`,
`blockedEventStream`, `eventStream`, and preview-panel state. Use the generated reference for the
complete `states` surface.

## Runtime Notes

- Browser storage persistence is best-effort. If `localStorage` writes fail, the SDK continues with
  in-memory state and retries persistence on future writes.
- `reset()` clears internal state except consent. Use it when the active profile changes.
- `flush()` drains queued Insights API and Experience API events.
- `destroy()` releases listeners and singleton ownership for explicit teardown paths such as tests
  or hot-reload workflows.
- Lifecycle interceptors exist for first-party SDK and preview-panel integration. Most application
  code should not need them directly.

## Related

- [Integrating the Optimization Web SDK in a Web App](https://contentful.github.io/optimization/documents/Documentation.Guides.integrating-the-web-sdk-in-a-web-app.html) -
  step-by-step browser integration guide
- [Web SDK generated reference](https://contentful.github.io/optimization/modules/_contentful_optimization-web.html) -
  exported API reference
- [React Web SDK](../frameworks/react-web-sdk/README.md) - React provider, hook, router, and
  `OptimizedEntry` layer built on this SDK
- [Web Vanilla reference implementation](../../../implementations/web-sdk/README.md) - static Web
  page using the vanilla JS drop-in build
- [Web SDK React Adapter reference implementation](../../../implementations/web-sdk_react/README.md) -
  React application that builds a local adapter layer directly on top of this SDK
