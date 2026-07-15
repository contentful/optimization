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

This SDK implements browser-specific optimization behavior on top of the
[Optimization Core SDK](../../universal/core-sdk/README.md). Use it directly for non-React browser
applications, framework adapters, and client-side runtimes that need consent state, anonymous ID
persistence, automatic entry interaction tracking, and browser-side event delivery.

If you are integrating a browser application, start with [Getting Started](#getting-started), then
use
[Integrating the Optimization Web SDK in a web app](https://contentful.github.io/optimization/documents/Documentation.Guides.integrating-the-web-sdk-in-a-web-app.html)
for the step-by-step flow. This README keeps the package orientation and common setup options close
at hand; generated [reference documentation](https://contentful.github.io/optimization) remains the
source of truth for exported API signatures.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Getting started](#getting-started)
  - [Usage in vanilla JS web pages](#usage-in-vanilla-js-web-pages)
  - [Usage with Web Components](#usage-with-web-components)
- [When to use this package](#when-to-use-this-package)
- [Common configuration](#common-configuration)
- [Core workflows](#core-workflows)
  - [Consent and profile events](#consent-and-profile-events)
  - [Content resolution](#content-resolution)
  - [Entry interaction tracking](#entry-interaction-tracking)
  - [State subscriptions](#state-subscriptions)
- [Runtime notes](#runtime-notes)
- [Related](#related)

<!-- mtoc-end -->
</details>

## Getting started

Install using an NPM-compatible package manager, pnpm for example:

```sh
pnpm install @contentful/optimization-web
```

Add `contentful` too when the SDK will use your app-owned `contentful.js` client for managed entry
fetching.

Import the Optimization class; both CJS and ESM module systems are supported, ESM preferred:

```ts
import ContentfulOptimization from '@contentful/optimization-web'
```

Configure and initialize the Optimization Web SDK once per page runtime:

```ts
const optimization = new ContentfulOptimization({
  clientId: 'your-client-id',
  environment: 'main',
  locale: 'en-US',
})
```

> [!IMPORTANT]
>
> Initialize the Web SDK once per page runtime. Reuse `window.contentfulOptimization` or your own
> singleton container binding instead of creating additional instances.

### Usage in vanilla JS web pages

The UMD build is available for HTML pages that do not use a bundler:

```html
<script src="https://cdn.jsdelivr.net/npm/@contentful/optimization-web@latest/dist/contentful-optimization-web.umd.js"></script>
<script>
  window.contentfulOptimization = new ContentfulOptimization({
    clientId: 'your-client-id',
    environment: 'main',
    locale: 'en-US',
  })
</script>
```

### Usage with Web Components

The optional Web Components entrypoint provides vanilla custom elements from the same package:

```ts
import { defineContentfulOptimizationElements } from '@contentful/optimization-web/web-components'

defineContentfulOptimizationElements()
```

Importing `@contentful/optimization-web/web-components` is side-effect-free. Custom elements are
registered only when `defineContentfulOptimizationElements()` runs, and the main
`@contentful/optimization-web` entrypoint does not export or register them.

Use `<ctfl-optimization-root>` once around the entries that share one SDK instance:

```html
<ctfl-optimization-root client-id="your-client-id" environment="main" locale="en-US">
  <ctfl-optimized-entry id="hero-entry">
    <article>Baseline content rendered by your app</article>
  </ctfl-optimized-entry>
</ctfl-optimization-root>
```

Assign complex values as DOM properties, not string attributes:

```ts
const root = document.querySelector('ctfl-optimization-root')
const entry = document.querySelector('ctfl-optimized-entry')

root.defaults = { consent: true }
root.api = { preflight: false }
root.contentful = { client: contentfulClient }
root.trackEntryInteraction = { hovers: false }
root.prefetchManagedEntries = ['hero-entry']
root.onStatesReady = (states) => {
  const subscription = states.profile.subscribe((profile) => {
    console.log(profile?.id)
  })

  return () => {
    subscription.unsubscribe()
  }
}

entry.baselineEntry = baselineEntry
entry.addEventListener('ctfl-entry-resolved', (event) => {
  renderHero(event.detail.entry, event.detail.metadata)
})
```

`baselineEntry` and root `contentful` are property-only because Contentful entries and clients are
structured objects. When the Web SDK is configured with `contentful: { client }`,
`ctfl-optimized-entry` can also fetch by `entry-id`/`entryId`; `baselineEntry` takes precedence when
both are set. Set the `entryQuery` property for per-entry CDA query overrides. Set the root
`prefetchManagedEntries` property to warm the configured SDK cache after the root SDK is ready. For
framework wrappers, assign `baselineEntry`, `entryQuery`, `sdk`, `defaults`, `api`, and callback
properties after client hydration, then listen for `ctfl-entry-loading`, `ctfl-entry-resolved`, and
`ctfl-entry-error` to render framework-owned UI. The custom element intentionally does not provide a
framework-neutral render-prop API. Framework wrappers that render without the custom element but
still use Web presentation helpers can import `OptimizedEntrySourceController` and
`createOptimizedEntryLoadingEntry` from `@contentful/optimization-web/presentation` to share the
same managed entry-source lifecycle. Core-only or non-Web custom runtime adapters can import those
entry-source primitives directly from `@contentful/optimization-core/entry-source` without depending
on the Web SDK.

For script-tag usage, load the main Web SDK UMD bundle and the separate Web Components UMD bundle:

```html
<script src="https://cdn.jsdelivr.net/npm/@contentful/optimization-web@latest/dist/contentful-optimization-web.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@contentful/optimization-web@latest/dist/contentful-optimization-web-components.umd.js"></script>
<script>
  ContentfulOptimizationWebComponents.defineContentfulOptimizationElements()
</script>
```

SSR output can include inert custom-element markup. On the client, call
`defineContentfulOptimizationElements()` and assign object properties before expecting entries to
resolve. A root shares SDK readiness and preview-panel live-update state with descendant entries;
entries diff `data-ctfl-*` host attributes and clean up subscriptions on disconnect. Prefer one root
per SDK instance unless a page genuinely needs separate SDK ownership.

## When to use this package

Use `@contentful/optimization-web` for browser applications that need the stateful Web runtime
directly, including consent state, anonymous ID persistence, automatic entry interaction tracking,
and browser-side event delivery.

We recommend starting React applications with
[`@contentful/optimization-react-web`](../frameworks/react-web-sdk/README.md), which wraps this SDK
with React providers, hooks, router adapters, and entry-rendering primitives.

## Common configuration

The Web SDK communicates with the Experience API for profile and optimization selection, and with
the Insights API for event ingestion.

| Option                      | Required? | Default                                       | Description                                                                       |
| --------------------------- | --------- | --------------------------------------------- | --------------------------------------------------------------------------------- |
| `clientId`                  | Yes       | N/A                                           | Shared API key for Experience API and Insights API requests                       |
| `environment`               | No        | `'main'`                                      | Contentful environment identifier                                                 |
| `api`                       | No        | See API options below                         | Experience API and Insights API endpoint and request options                      |
| `app`                       | No        | `undefined`                                   | Application metadata attached to outgoing event context                           |
| `contentful`                | No        | `undefined`                                   | App-owned `contentful.js` client, default query, and cache                        |
| `locale`                    | No        | `undefined`                                   | SDK Experience API and default event locale                                       |
| `defaults`                  | No        | `undefined`                                   | Initial state, commonly including consent, persistence consent, or profile values |
| `allowedEventTypes`         | No        | `['identify', 'page']`                        | Event types intentionally allowed while consent is unset or false                 |
| `autoTrackEntryInteraction` | No        | `{ views: true, clicks: true, hovers: true }` | Opt-out automatic tracking for entry views, clicks, and hovers                    |
| `cookie`                    | No        | `{ domain: undefined, expires: 365 }`         | Anonymous ID cookie settings                                                      |
| `getAnonymousId`            | No        | `undefined`                                   | Function used to provide an anonymous ID from application-owned identity state    |
| `queuePolicy`               | No        | SDK defaults                                  | Flush retry behavior and offline queue bounds                                     |
| `logLevel`                  | No        | `'error'`                                     | Minimum log level for the default console sink                                    |
| `onEventBlocked`            | No        | `undefined`                                   | Callback invoked when consent blocks an event                                     |

Common `api` options:

| Option              | Required? | Default                                                          | Description                                           |
| ------------------- | --------- | ---------------------------------------------------------------- | ----------------------------------------------------- |
| `experienceBaseUrl` | No        | `'https://experience.ninetailed.co/'`                            | Base URL for the Experience API                       |
| `insightsBaseUrl`   | No        | `'https://ingest.insights.ninetailed.co/'`                       | Base URL for the Insights API                         |
| `enabledFeatures`   | No        | `['ip-enrichment', 'location']`                                  | Experience API features to apply to each request      |
| `preflight`         | No        | `false`                                                          | Aggregate a new profile state without storing it      |
| `plainText`         | No        | `true` for single-profile mutations; batch mutations use `false` | Sends eligible Experience API mutations as plain text |

Common `fetchOptions` are `fetchMethod`, `requestTimeout`, `retries`, `intervalTimeout`,
`onFailedAttempt`, and `onRequestTimeout`. Default retries intentionally apply only to HTTP `503`
responses.

Configured `allowedEventTypes` are an intentional allow-list, not a temporary state. The Web default
allows `identify` and `page` while consent is unset or false. Set `allowedEventTypes: []` for strict
opt-in when no Optimization event may emit before accepted consent.

Choose the application Contentful locale in your router, i18n layer, or app configuration. Pass that
value directly to Contentful CDA requests. Use the top-level SDK `locale` when Experience API
responses and event context need to use the same language. See
[Locale handling in the Optimization SDK Suite](https://contentful.github.io/optimization/documents/Documentation.Concepts.Locale_handling_in_the_Optimization_SDK_Suite.html)
for the full locale model.

Use `optimization.setLocale(nextLocale)` when the application locale changes. The method validates
the explicit input, updates `optimization.locale` and `optimization.states.locale`, and changes the
default Experience API locale. It does not fetch content or refresh profile state; call `page()`,
`identify()`, or CDA methods again when the app needs localized data for the new locale.

For every option, callback payload, and exported type, use the generated
[Web SDK reference](https://contentful.github.io/optimization/modules/_contentful_optimization-web.html).

## Core workflows

### Consent and profile events

Consent is application policy. The SDK stores event consent, blocks non-allowed events until event
consent is accepted, and intentionally allows configured `allowedEventTypes` in every consent state.
It can track durable profile-continuity persistence consent separately. For cross-SDK consent
guidance, see
[Consent management in the Optimization SDK Suite](../../../documentation/concepts/consent-management-in-the-optimization-sdk-suite.md).

For default-on application policies that do not render an end-user consent UI, seed accepted consent
at startup:

```ts
const optimization = new ContentfulOptimization({
  clientId: 'your-client-id',
  defaults: { consent: true },
})
```

```ts
optimization.consent(true)

optimization.consent({ events: true, persistence: false })

const { accepted, data } = await optimization.page({
  properties: { path: window.location.pathname },
})
```

The startup default and boolean consent calls grant or withdraw both event consent and durable
profile continuity by default. Withdrawing event consent still permits configured
`allowedEventTypes`; use `allowedEventTypes: []` for strict opt-in. Object-form consent lets events
emit while keeping profile, selected optimizations, changes, and the anonymous ID session-only until
persistence consent is granted.

`page()`, `identify()`, `screen()`, `track()`, and sticky `trackView()` calls return an event
result. `{ accepted: false }` means consent or SDK guards blocked the event.
`{ accepted: true, data }` means the SDK accepted the event; accepted queued or offline events might
not have data yet. Router integrations that need current-route deduplication can call
`trackCurrentPage()`. Direct manual `page()` calls remain non-deduping event emits.

### Content resolution

When a `contentful.js` client is available, prefer SDK-managed fetching by entry ID:

```ts
const optimization = new ContentfulOptimization({
  clientId: 'client-id',
  contentful: { client: contentfulClient },
  environment: 'main',
  locale: appLocale,
})

const { baselineEntry, entry } = await optimization.fetchOptimizedEntry('hero-entry')
```

`fetchOptimizedEntry(entryId)` fetches the baseline entry and resolves it with the Web SDK's current
`selectedOptimizations` when omitted. `fetchContentfulEntry()` only performs the managed CDA fetch.
Use `fetchContentfulEntries()` or `prefetchManagedEntries()` when a page knows several managed entry
IDs. Entries with the same normalized query share one `getEntries()` call; same-tick single-entry
calls can join that batch. Large `getEntries()` fetches are split into 100-ID chunks.

If your application already fetched the baseline entry, keep using the manual resolver:

```ts
const { accepted, data: optimizationData } = await optimization.page({
  properties: { path: location.pathname },
})
const resolvedEntry = optimization.resolveOptimizedEntry(
  baselineEntry,
  accepted ? optimizationData?.selectedOptimizations : undefined,
)
```

Use one CDA locale in either path. For localized apps, configure your application locale and pass it
directly before calling `getEntry()`, `getEntries()`, or SDK-managed entry fetches. Do not pass
all-locale CDA responses from `withAllLocales` or `locale=*`; the resolver expects direct
single-locale field values. See
[Entry optimization and variant resolution](https://contentful.github.io/optimization/documents/Documentation.Concepts.Entry_personalization_and_variant_resolution.html#single-locale-cda-entry-contract)
for the entry contract and
[Locale handling in the Optimization SDK Suite](https://contentful.github.io/optimization/documents/Documentation.Concepts.Locale_handling_in_the_Optimization_SDK_Suite.html)
for the broader locale model.

Use `getMergeTagValue()` for Contentful Rich Text merge tags and `getFlag()` for Custom Flags. If a
merge tag references localized profile fields such as `location.city` or `location.country`, its
resolved value follows the localized profile data returned by the Experience API. The Web SDK is
stateful, so reading a flag can emit deduplicated flag-view tracking when consent or the allow-list
permits it and profile state is available.

### Entry interaction tracking

Automatic tracking is enabled when entry elements follow the standard data-attribute pattern. Pass
`false` for any interaction type that your application does not want to observe:

```ts
const optimization = new ContentfulOptimization({
  clientId: 'your-client-id',
  autoTrackEntryInteraction: { hovers: false },
})
```

Use manual element overrides when the DOM structure does not fit automatic observation:

```ts
optimization.tracking.enableElement('views', element, {
  data: {
    entryId: resolvedEntry.entry.sys.id,
    optimizationId: resolvedEntry.selectedOptimization?.experienceId,
    optimizationContextId: resolvedEntry.optimizationContextId,
    variantIndex: resolvedEntry.selectedOptimization?.variantIndex ?? 0,
  },
})
```

`optimizationContextId` is SDK-owned context for follow-up event enrichment and diagnostics. It is
not an API event payload field.

For detection thresholds, data attributes, click and hover behavior, and manual overrides, use the
[Web SDK integration guide](https://contentful.github.io/optimization/documents/Documentation.Guides.integrating-the-web-sdk-in-a-web-app.html#7-track-entry-interactions-and-follow-up-events).

### State subscriptions

The stateful Web SDK exposes observable state for UI feedback and integration glue:

```ts
const unsubscribe = optimization.states.profile.subscribe((profile) => {
  console.log(profile?.id)
})
```

Common state streams include `consent`, `persistenceConsent`, `profile`, `selectedOptimizations`,
`blockedEventStream`, `eventStream`, and preview-panel state. Optimization changes are internal
state consumed through flag and entry resolution, not an `optimization.states.changes` stream. Use
the generated reference for the complete `states` surface.

## Runtime notes

- Browser storage persistence is best-effort. If `localStorage` writes fail, the SDK continues with
  in-memory state and retries persistence on subsequent writes.
- `reset()` clears internal state except consent and persistence consent. Use it when the active
  profile changes.
- `flush()` drains queued Insights API and Experience API events.
- Browser lifecycle events use `navigator.sendBeacon()` for last-chance Insights delivery.
- `destroy()` releases listeners and singleton ownership for explicit teardown paths such as tests
  or hot-reload workflows.
- Lifecycle interceptors exist for first-party SDK and preview-panel integration. Most application
  code does not need them directly.

## Related

- [Integrating the Optimization Web SDK in a web app](https://contentful.github.io/optimization/documents/Documentation.Guides.integrating-the-web-sdk-in-a-web-app.html) -
  step-by-step browser integration guide
- [Web SDK generated reference](https://contentful.github.io/optimization/modules/_contentful_optimization-web.html) -
  exported API reference
- [React Web SDK](../frameworks/react-web-sdk/README.md) - React provider, hook, router, and
  `OptimizedEntry` layer built on this SDK
- [Web Vanilla reference implementation](../../../implementations/web-sdk/README.md) - static Web
  page using the vanilla JS drop-in build
- [Web SDK React Adapter reference implementation](../../../implementations/web-sdk_react/README.md) -
  React application that builds a local adapter layer directly on top of this SDK
