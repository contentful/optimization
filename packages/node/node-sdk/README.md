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
pnpm add @contentful/optimization-node
```

Import the Optimization class; both CJS and ESM module systems are supported, ESM preferred:

```ts
import ContentfulOptimization from '@contentful/optimization-node'
```

Create the SDK once per module or process, then bind consent and request context in each route:

```ts
const optimization = new ContentfulOptimization({
  clientId: 'your-client-id',
  environment: 'main',
  locale: 'en-US',
})

function appPolicyAllowsOptimizationEvent(req: { cookies?: Record<string, string> }): boolean {
  return req.cookies?.['app-personalization-consent'] === 'granted'
}

async function renderRequest(
  req: { cookies?: Record<string, string>; headers: { 'accept-language'?: string } },
  profileId: string,
) {
  const appLocale = getAppLocale(req)
  const requestOptimization = optimization.forRequest({
    consent: {
      events: appPolicyAllowsOptimizationEvent(req),
      persistence: appPolicyAllowsOptimizationEvent(req),
    },
    locale: appLocale,
    eventContext: { locale: appLocale },
    profile: { id: profileId },
  })

  const { accepted, data } = await requestOptimization.page()

  return accepted ? data : undefined
}
```

## When to use this package

Use `@contentful/optimization-node` for server-side rendering, server functions, and Node services
that need stateless profile evaluation or event emission. Use the Web or React Web SDK alongside it
when browser-side consent, anonymous ID persistence, automatic interaction tracking, or live updates
are part of the same application.

## Common configuration

The Node SDK is stateless. It does not maintain consent, profile, or browser persistence state
between requests. For cross-SDK consent guidance, see
[Consent management in the Optimization SDK Suite](../../../documentation/concepts/consent-management-in-the-optimization-sdk-suite.md).

| Option              | Required? | Default                | Description                                                 |
| ------------------- | --------- | ---------------------- | ----------------------------------------------------------- |
| `clientId`          | Yes       | N/A                    | Shared API key for Experience API and Insights API requests |
| `environment`       | No        | `'main'`               | Contentful environment identifier                           |
| `api`               | No        | See API options below  | Experience API and Insights API endpoint options            |
| `app`               | No        | `undefined`            | Application metadata attached to outgoing event context     |
| `locale`            | No        | `undefined`            | Default SDK Experience API and event locale                 |
| `fetchOptions`      | No        | SDK defaults           | Fetch timeout and retry behavior                            |
| `allowedEventTypes` | No        | `['identify', 'page']` | Event types allowed before request event consent is granted |
| `eventBuilder`      | No        | Node SDK defaults      | Event metadata overrides for SDK-layer authors              |
| `logLevel`          | No        | `'error'`              | Minimum log level for the default console sink              |

Common `api` options:

| Option              | Required? | Default                                    | Description                                      |
| ------------------- | --------- | ------------------------------------------ | ------------------------------------------------ |
| `experienceBaseUrl` | No        | `'https://experience.ninetailed.co/'`      | Base URL for the Experience API                  |
| `insightsBaseUrl`   | No        | `'https://ingest.insights.ninetailed.co/'` | Base URL for the Insights API                    |
| `enabledFeatures`   | No        | `['ip-enrichment', 'location']`            | Experience API features to apply to each request |

Request-scoped Experience options belong in `experienceOptions` when creating the request-bound
client:

| Option      | Description                                                   |
| ----------- | ------------------------------------------------------------- |
| `ip`        | IP address override used by the Experience API                |
| `locale`    | Locale query parameter for localized Experience API responses |
| `plainText` | Sends performance-critical Experience API endpoints as text   |
| `preflight` | Aggregates a new profile state without storing it             |

Request-scoped Insights options belong in `insightsOptions`:

| Option   | Description                                                       |
| -------- | ----------------------------------------------------------------- |
| `beacon` | Last-chance sender for serialized Insights API batches if needed. |

Use the request-scoped top-level `locale` on `forRequest()` as the promoted path for localized
Experience API responses and default event context. `experienceOptions.locale` remains available as
an advanced low-level pass-through when `locale` is not supplied. If both are provided, request
`locale` wins.

Common `fetchOptions` are `fetchMethod`, `requestTimeout`, `retries`, `intervalTimeout`,
`onFailedAttempt`, and `onRequestTimeout`. Default retries intentionally apply only to HTTP `503`
responses.

Choose the application Contentful locale in your router, i18n layer, or request policy. Pass that
value directly to Contentful CDA requests, and pass the same value to
`forRequest({ locale: appLocale })` when Experience API responses and event context should use the
same language. Merge tags that reference localized profile fields such as `location.city` and
`location.country` then resolve in a language consistent with the rendered content. See
[Locale handling in the Optimization SDK Suite](https://contentful.github.io/optimization/documents/Documentation.Concepts.Locale_handling_in_the_Optimization_SDK_Suite.html)
for the full locale model.

For every option, callback payload, and exported type, use the generated
[Node SDK reference](https://contentful.github.io/optimization/modules/_contentful_optimization-node.html).

## Core workflows

### Request-scoped events

Build event context from the incoming request, bind application-owned consent state with
`forRequest()`, then call `page()`, `identify()`, `screen()`, `track()`, or sticky `trackView()` on
the returned request object:

```ts
import type { Request } from 'express'

app.get('/products/:slug', async (req, res) => {
  const appLocale = getAppLocale(req)
  const requestOptimization = optimization.forRequest({
    consent: {
      events: appPolicyAllowsOptimizationEvent(req),
      persistence: appPolicyAllowsOptimizationEvent(req),
    },
    locale: appLocale,
    eventContext: {
      locale: appLocale,
    },
    profile: { id: req.cookies.profileId },
  })
  const { accepted, data: optimizationData } = await requestOptimization.page({
    properties: { path: req.path },
  })

  if (accepted && requestOptimization.canPersistProfile && optimizationData?.profile.id) {
    persistProfileId(res, optimizationData.profile.id)
  }

  res.render('product', { optimizationData })
})
```

For default-on application policies that do not render an end-user consent UI, replace the
request-specific consent lookup with accepted consent:

```ts
const requestOptimization = optimization.forRequest({
  consent: { events: true, persistence: true },
  locale: appLocale,
  eventContext: { locale: appLocale },
  profile,
})
```

Node SDK event calls fail closed except for the default pre-consent allowlist, `identify` and
`page`. Those allowlisted events are sent with `context.gdpr.isConsentGiven: false` when request
event consent is not granted. Pass `allowedEventTypes: []` to require strict opt-in for all
stateless event methods.

In stateless runtimes, Insights-backed methods require a request-bound profile for delivery.
Non-sticky `trackView`, `trackClick`, `trackHover`, and `trackFlagView` require a profile ID passed
to `forRequest()`.

### Content resolution

Fetch Contentful entries in your application layer, then resolve variants with returned optimization
data:

```ts
const resolvedEntry = optimization.resolveOptimizedEntry(
  baselineEntry,
  optimizationData?.selectedOptimizations,
)
```

Fetch entries with one CDA locale in the app layer. For localized apps, configure your application
locale and pass it directly to Contentful CDA requests. Pass the same value to
`forRequest({ locale: appLocale })` when MergeTags that read localized profile fields should match
the rendered entry language. Do not pass all-locale CDA responses from `withAllLocales` or
`locale=*` into `resolveOptimizedEntry()`; the resolver expects direct single-locale field values.
See
[Entry personalization and variant resolution](https://contentful.github.io/optimization/documents/Documentation.Concepts.Entry_personalization_and_variant_resolution.html#single-locale-cda-entry-contract)
for the entry contract and
[Locale handling in the Optimization SDK Suite](https://contentful.github.io/optimization/documents/Documentation.Concepts.Locale_handling_in_the_Optimization_SDK_Suite.html)
for request locale behavior.

Use `getMergeTagValue()` for Contentful Rich Text merge tags and `getFlag()` for Custom Flags. If a
merge tag references localized profile fields such as `location.city` or `location.country`, its
resolved value follows the localized profile data returned by the Experience API. The Node SDK is
stateless, so `getFlag()` does not automatically emit flag-view tracking.

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
