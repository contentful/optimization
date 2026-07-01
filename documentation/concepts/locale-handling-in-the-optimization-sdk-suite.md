---
title: Locale handling in the Optimization SDK Suite
---

# Locale handling in the Optimization SDK Suite

Use this document to keep the application Contentful locale separate from the SDK Experience/event
locale across Web, React Web, Next.js, Node, React Native, iOS, and Android applications. For
app-owned content fetching and entry resolution, the SDKs do not resolve Contentful locales, create
Contentful Delivery API clients, or infer browser, device, or request locales. Applications choose
their own locale from routing, i18n, native state, or request logic and pass it to manual Contentful
calls or SDK-managed entry fetching. Preview and debug tooling is separate: preview-panel APIs can
use Contentful clients to load Optimization definitions, but they do not choose locales for
application content.

For entry replacement mechanics, see
[Entry optimization and variant resolution](./entry-personalization-and-variant-resolution.md). For
package setup, use the relevant integration guide or package README.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Runtime locale surfaces](#runtime-locale-surfaces)
- [The locale channels](#the-locale-channels)
- [Application Contentful locale](#application-contentful-locale)
- [SDK Experience and event locale](#sdk-experience-and-event-locale)
- [Stateful SDKs](#stateful-sdks)
- [Next.js adapter](#nextjs-adapter)
- [Node and stateless SDKs](#node-and-stateless-sdks)
- [Entry resolution and localized Contentful content](#entry-resolution-and-localized-contentful-content)
- [Application responsibilities](#application-responsibilities)
- [Related documentation](#related-documentation)

<!-- mtoc-end -->
</details>

## Runtime locale surfaces

Each runtime exposes the SDK Experience/event locale through its own API surface:

| Runtime          | Locale API surface                                                                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Web**          | `new ContentfulOptimization({ locale })`, `optimization.locale`, `optimization.states.locale`, `optimization.setLocale(locale)`, and `<ctfl-optimization-root locale="...">`                                    |
| **React Web**    | `<OptimizationRoot locale>`, provider-owned `<OptimizationProvider locale>`, and `useOptimization()` access to `sdk.locale`, `sdk.states.locale`, and `sdk.setLocale(locale)`                                   |
| **Next.js**      | Server `createNextjsOptimization({ locale })`, request-scoped `getNextjsServerOptimizationData(sdk, { locale })`, ESR `getNextjsEsrOptimizationData(sdk, { locale })`, and client `OptimizationRoot locale`     |
| **Node**         | `new ContentfulOptimization({ locale })` for a default, `optimization.forRequest({ locale })` for request scope, and `experienceOptions.locale` as an advanced pass-through when request `locale` is absent     |
| **React Native** | `<OptimizationRoot locale>`, provider-owned `<OptimizationProvider locale>`, `ContentfulOptimization.create({ locale })`, `sdk.locale`, and `sdk.setLocale(locale)`                                             |
| **iOS**          | `OptimizationConfig(locale:)`, `OptimizationRoot(config:)`, `OptimizationClient.locale`, and `OptimizationClient.setLocale(_:)`                                                                                 |
| **Android**      | `OptimizationConfig(locale = ...)`, Compose `OptimizationRoot(config = ...)`, XML Views `OptimizationManager.initialize(config = ...)`, `OptimizationClient.locale`, and `OptimizationClient.setLocale(locale)` |

## The locale channels

Locale handling in an optimized application has two application-facing channels.

| Channel                       | Owned by                                                           | Used for                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application Contentful locale | Application router, i18n layer, request logic, or native app state | Contentful Delivery API (CDA) and Contentful Preview API (CPA) `locale` query values, UI language, route language, cache keys, and content refetching |
| SDK Experience/event locale   | Optimization SDK configuration or request options                  | Experience API `locale` query values and default event `context.locale`                                                                               |

The same string is often used for both channels, but the SDK treats them as separate inputs. The SDK
does not know which Contentful locales are enabled in a space and does not validate that an SDK
locale is supported by Contentful.

## Application Contentful locale

Choose an `appLocale` with application-owned logic, then pass it to CDA or CPA calls. JavaScript
managed fetching uses the application-owned `contentful.js` client from `contentful: { client }`;
the SDK does not create clients, discover Contentful locales, infer browser or request locales, or
own locale policy.

SDK-managed Contentful fetch, JavaScript runtimes (TypeScript):

```ts
const appLocale = getAppLocale()

const optimization = new ContentfulOptimization({
  clientId,
  contentful: {
    client: contentfulClient,
    defaultQuery: { locale: appLocale },
  },
  locale: appLocale,
})

const entry = await optimization.fetchContentfulEntry(entryId, {
  locale: appLocale,
})
```

Per-call `entryQuery` or `query` values override `contentful.defaultQuery`. If no Contentful query
locale is provided, managed fetching falls back to the SDK `locale` before calling
`contentful.js getEntry()`. Request-bound Node clients use `forRequest({ locale })` as that
fallback. Use a concrete locale such as `en-US`; do not use `withAllLocales` or `locale=*` for
entries that the SDK will resolve.

Manual Contentful fetch, JavaScript runtimes (TypeScript):

```ts
const entry = await contentfulClient.getEntry(entryId, {
  include: 10,
  locale: appLocale,
})
```

Pass the same `appLocale` anywhere Contentful content is fetched: browser data loaders, React hooks,
server routes, React Native services, and native app content clients. If the app omits `locale`,
Contentful uses the space default locale.

Use the same `appLocale` in cache keys when localized content can differ.

JavaScript runtimes (TypeScript):

```ts
const cacheKey = `${appLocale}:${entryId}`
```

## SDK Experience and event locale

Stateful SDKs accept top-level `locale` as the default SDK Experience/event locale:

Web runtime (TypeScript):

```ts
const appLocale = getAppLocale()

const optimization = new ContentfulOptimization({
  clientId,
  locale: appLocale,
})
```

That value initializes the SDK locale state, sets the default Experience API request locale, and
provides the default event context locale. If `locale` is omitted, the Experience API locale query
is omitted by default. Event payloads still include `context.locale: 'en-US'` when neither an SDK
locale nor an event payload locale is available, because the event schemas require a locale.

The Experience API locale is not a Contentful CDA locale. It can localize Experience API profile
fields, such as `location.city` and `location.country` values used by MergeTags, and the SDK also
copies it into the default event `context.locale`. It does not localize Contentful entries or
resolve Contentful locale fallbacks.

The low-level Experience API client still supports its own default and per-request `locale` options.
Use those when calling the low-level API client directly or when an advanced stateless request needs
a pass-through.

## Stateful SDKs

Web, React Web, React Native, iOS, and Android keep live locale state:

- JavaScript SDKs expose `optimization.locale`, `optimization.states.locale`, and
  `optimization.setLocale(locale)`.
- Web custom elements apply `<ctfl-optimization-root locale="...">` to the SDK instance that the
  element creates and owns. If the element reuses an assigned `sdk` property or the global
  `window.contentfulOptimization` instance, update that SDK instance with `setLocale()`.
- React Web and React Native providers update provider-owned SDK instances when their `locale` prop
  changes.
- iOS exposes `OptimizationClient.locale` and `OptimizationClient.setLocale(_:)`.
- Android exposes `OptimizationClient.locale` and `OptimizationClient.setLocale(locale)`.

On iOS and Android, call `setLocale` only after the client has initialized; set the initial locale
through `OptimizationConfig` before mounting or initializing.

`setLocale(locale)` validates and normalizes the SDK Experience/event locale. It does not refetch
Contentful content, update routes, or clear application caches. JavaScript managed fetching can use
the SDK locale only as the fallback `getEntry()` query locale when neither `contentful.defaultQuery`
nor a per-call query provides one. Application code must refetch Contentful entries with its chosen
Contentful locale.

Web or React Web client runtime (TypeScript):

```ts
const nextLocale = getAppLocaleFromRoute()

optimization.setLocale(nextLocale)

const entry = await contentfulClient.getEntry(entryId, {
  include: 10,
  locale: nextLocale,
})
```

## Next.js adapter

Next.js composes the stateless Node SDK on the server with the React Web SDK on the client. The
server default locale comes from `createNextjsOptimization({ locale })`, but per-request locale
binding belongs in `getNextjsServerOptimizationData(sdk, { locale })` for App Router Server
Components or `getNextjsEsrOptimizationData(sdk, { locale })` for request-rendered ESR flows. The
client `OptimizationRoot locale` prop follows the React Web behavior.

Next.js server runtime (TypeScript):

```ts
const optimization = createNextjsOptimization({
  clientId,
  locale: defaultLocale,
})

const { data } = await getNextjsServerOptimizationData(optimization, {
  consent,
  cookies,
  headers,
  locale: appLocale,
})

export const proxy = createNextjsOptimizationContextHandler()
```

Use the request-scoped `locale` path when a route can serve different locales. A module-level
`createNextjsOptimization({ locale })` value is a default for the server SDK instance, not the
current request locale. Server Components pass `headers()` to `getNextjsServerOptimizationData()` so
the SDK can derive page context from the request URL captured by the Next.js proxy or middleware
helper.

Locale handoff is separate from server optimization state handoff. When the browser provider has the
server data at its boundary, pass it with `serverOptimizationState` on `OptimizationRoot`. When a
shared App Router layout owns the provider and the page owns request-local data, render
`NextjsOptimizationState` near the server-rendered optimized content. Keep `defaults` for
configuration or default state such as consent policy, not for server-returned profile, selected
optimizations, or changes.

## Node and stateless SDKs

Node and other stateless environments can set a constructor `locale`, but that value is a default
for the SDK instance. Bind request-specific locale with `forRequest({ locale })`, which is the
promoted request-scoped path for localized Experience API responses and default event context.

Node server runtime (TypeScript):

```ts
const appLocale = getAppLocale(request)
const requestUserAgent = getRequestUserAgent(request)

const requestOptimization = optimization.forRequest({
  consent: true,
  locale: appLocale,
  eventContext: {
    page: getPageContext(request),
    userAgent: requestUserAgent ?? 'server',
  },
})

const [entry, data] = await Promise.all([
  contentfulClient.getEntry(entryId, { include: 10, locale: appLocale }),
  requestOptimization.page(),
])
```

`forRequest({ locale })` sets the request-bound Experience API locale and default event context
locale. If both `locale` and `experienceOptions.locale` are supplied, `locale` wins. Use
`experienceOptions.locale` only as an advanced low-level pass-through when `locale` is not supplied.
When a Node SDK is configured with `contentful: { client }`, root `fetchOptimizedEntry(entryId)`
needs explicit `selectedOptimizations` for personalized results. A request-bound `forRequest()`
client uses the latest accepted Experience response selections by default when
`fetchOptimizedEntry(entryId)` omits `selectedOptimizations`. It also uses the request `locale` as
the managed Contentful query locale when neither `contentful.defaultQuery` nor the per-call query
sets `locale`.

## Entry resolution and localized Contentful content

Entry resolution expects one localized view of a baseline entry and linked optimization entries.
Pass direct single-locale field values to the runtime-specific entry resolution surface:

- Core, Web, and Node `fetchContentfulEntry()` and `fetchOptimizedEntry()` for JavaScript
  SDK-managed fetching through an app-owned `contentful.js` client.
- Web and Node `resolveOptimizedEntry()` for manual baseline entries.
- React Web `OptimizedEntry` and `useOptimizedEntry()` with either `baselineEntry` or managed
  `entryId` plus optional `entryQuery`.
- Web Component `ctfl-optimized-entry` with either `baselineEntry` or managed `entry-id`/`entryId`
  plus optional `entryQuery`.
- Next.js server `resolveOptimizedEntry()` or managed `fetchOptimizedEntry()`; pass manual
  `baselineEntry` and `resolvedData` props or the managed result to `ServerOptimizedEntry` when
  server-rendered tracking attributes are needed.
- React Native `OptimizedEntry` and `useOptimizedEntry()` with either `baselineEntry` or managed
  `entryId` plus optional `entryQuery`; `useEntryResolver()` remains manual-only.
- iOS `OptimizationClient.resolveOptimizedEntry(baseline:selectedOptimizations:)` and SwiftUI
  `OptimizedEntry(entry:)`.
- Android `OptimizationClient.resolveOptimizedEntry(...)`, Compose `OptimizedEntry(entry:)`, and XML
  Views `OptimizedEntryView.setEntry(...)`.

Do not pass all-locale CDA responses from `withAllLocales` or `locale=*`.

The SDK does not mutate application Contentful clients or infer when a content refetch is needed.
When route or language state changes, the application must update SDK locale state, refetch
Contentful content with the app locale, clear SDK-managed Contentful entry cache entries when those
cached CDA results are no longer valid, and invalidate app caches as needed.

## Application responsibilities

Applications own:

- Choosing the application Contentful locale from routes, request context, i18n state, or native app
  state.
- Passing the Contentful locale to manual CDA and CPA requests or SDK-managed `contentful.js`
  fetching.
- Passing the SDK Experience/event locale through top-level SDK `locale`, provider `locale`, Next.js
  `getNextjsServerOptimizationData({ locale })`, Next.js ESR
  `getNextjsEsrOptimizationData({ locale })`, native config `locale`, native `setLocale`, or Node
  `forRequest({ locale })`.
- Keeping localized content cache keys distinct.
- Refetching Contentful content after locale changes.
- Ensuring the Contentful locale is supported by the target Contentful environment.

## Related documentation

- [Entry optimization and variant resolution](./entry-personalization-and-variant-resolution.md)
- [Integrating the Web SDK in a web app](../guides/integrating-the-web-sdk-in-a-web-app.md)
- [Integrating the React Web SDK in a React app](../guides/integrating-the-react-web-sdk-in-a-react-app.md)
- [Integrating the Optimization Next.js SDK in a Next.js app (SSR)](../guides/integrating-the-optimization-sdk-in-a-nextjs-app-ssr.md)
- [Integrating the Optimization Next.js SDK in a Next.js app (hybrid SSR + CSR takeover)](../guides/integrating-the-optimization-sdk-in-a-nextjs-app-ssr-csr.md)
- [Integrating the Node SDK in a Node app](../guides/integrating-the-node-sdk-in-a-node-app.md)
- [Integrating the Optimization React Native SDK in a React Native app](../guides/integrating-the-react-native-sdk-in-a-react-native-app.md)
- [React Native SDK interaction tracking mechanics](./react-native-sdk-interaction-tracking-mechanics.md)
- [Integrating the Optimization iOS SDK in a SwiftUI app](../guides/integrating-the-optimization-ios-sdk-in-a-swiftui-app.md)
- [Integrating the Optimization iOS SDK in a UIKit app](../guides/integrating-the-optimization-ios-sdk-in-a-uikit-app.md)
- [iOS SDK runtime and interaction mechanics](./ios-sdk-runtime-and-interaction-mechanics.md)
- [Integrating the Optimization Android SDK in a Jetpack Compose app](../guides/integrating-the-optimization-android-sdk-in-a-compose-app.md)
- [Integrating the Optimization Android SDK in an Android Views app](../guides/integrating-the-optimization-android-sdk-in-a-views-app.md)
- [Android SDK runtime and interaction mechanics](./android-sdk-runtime-and-interaction-mechanics.md)
