---
title: Locale handling in the Optimization SDK Suite
---

# Locale handling in the Optimization SDK Suite

Use this document to understand how locales move through Contentful, `contentful.js`, the Experience
API, and the Optimization SDK Suite. It explains which layer owns each locale decision, why the SDKs
resolve locales before fetching Contentful entries, and where applications must keep content, event,
and profile localization aligned.

For entry replacement mechanics, see
[Entry personalization and variant resolution](./entry-personalization-and-variant-resolution.md).
For package setup, use the relevant integration guide or package README.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [The locale channels](#the-locale-channels)
- [Contentful locale background](#contentful-locale-background)
  - [Contentful Delivery API response shapes](#contentful-delivery-api-response-shapes)
  - [`contentful.js` locale modifiers](#contentfuljs-locale-modifiers)
- [Why the SDKs resolve one Contentful locale](#why-the-sdks-resolve-one-contentful-locale)
- [SDK locale configuration](#sdk-locale-configuration)
  - [Resolution modes](#resolution-modes)
  - [Candidate matching](#candidate-matching)
  - [Validation](#validation)
- [Runtime behavior](#runtime-behavior)
  - [Browser and React Web](#browser-and-react-web)
  - [Node and SSR](#node-and-ssr)
  - [React Native](#react-native)
  - [iOS and Android](#ios-and-android)
- [Experience API localization](#experience-api-localization)
- [Entry resolution and localized Contentful content](#entry-resolution-and-localized-contentful-content)
- [Application responsibilities](#application-responsibilities)
- [Caveats and gotchas](#caveats-and-gotchas)
- [Related documentation](#related-documentation)

<!-- mtoc-end -->
</details>

## The locale channels

Locale handling in an optimized application has multiple channels. Keeping those channels separate
prevents the most common integration bugs.

| Channel                              | Owned by                                                                         | Used for                                                                                            |
| ------------------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Contentful locale                    | Contentful and the application Content Delivery API call                         | Selecting the localized entry, asset, and linked-entry field values returned by Contentful.         |
| SDK-resolved Contentful locale       | Optimization SDK locale helpers                                                  | Choosing a configured Contentful locale code before an app-owned CDA fetch.                         |
| Runtime or request locale candidates | Browser, device, route, server request, or application state                     | Inputs that the SDK can match against configured Contentful locale codes.                           |
| Experience API request locale        | Experience API request option, stateful `api.locale`, or the SDK-resolved locale | Localizing Experience API response data such as profile location fields that merge tags can render. |
| Event context locale                 | Event payload context                                                            | Recording the visitor or request locale as analytics and audience-rule data.                        |
| Application UI or route locale       | Application router, i18n framework, or native app state                          | Choosing URLs, UI strings, navigation, and refetch timing.                                          |

The SDKs can help resolve and expose a Contentful locale, but they do not own routing, translation
resources, Contentful fetching, or when the application refreshes data after a language change.

## Contentful locale background

Contentful locales are configured at the environment level. Each locale has a code, one default
locale exists for the environment, and non-default locales can have a fallback locale. Contentful
can also control whether a locale is included in Content Delivery API and Content Preview API
responses.

Contentful supports several localization modeling approaches, including field-level localization,
entry-level localization, content type-level localization, and space-level localization. The
Optimization SDK Suite does not choose one of those approaches for you. The SDKs care about the
delivery payload passed to entry resolution: it must represent one localized view of the baseline
entry and its linked optimization entries.

### Contentful Delivery API response shapes

The Content Delivery API (CDA) can return localized entry fields in two important shapes:

| CDA request                 | Field shape                                                                                             | `sys.locale` | SDK entry-resolution compatibility                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------- |
| No `locale` query parameter | Direct field values from the space default locale                                                       | Present      | Compatible when the app intentionally uses the default locale.             |
| `locale=<code>`             | Direct field values for the requested locale, with Contentful locale fallback applied to missing fields | Present      | Compatible. This is the recommended shape for localized optimized entries. |
| `locale=*`                  | Locale-keyed field maps such as `fields.title['en-US']`                                                 | Not set      | Not compatible with SDK entry resolution.                                  |

For a configured locale request such as `locale=de-DE`, Contentful applies the locale fallback chain
defined in the space when a localized field value is missing. That fallback belongs to Contentful
and happens before the Optimization SDK sees the entry payload.

For `locale=*`, Contentful returns every available locale under locale-code keys. That shape is
useful for some synchronization and authoring workflows, but it does not match the direct field
values the Optimization SDK resolver reads.

### `contentful.js` locale modifiers

`contentful.js` follows the same delivery shapes:

- The default client returns entries and assets in one locale.
- `client.withAllLocales` returns entries and assets with all locales.
- The Sync API returns all localized content, so `withAllLocales` is accepted but not meaningful for
  changing that Sync API behavior.

The Optimization SDK helper `withOptimizationLocale(contentfulClient)` is designed for the
single-locale `getEntry()` and `getEntries()` path. It injects the live SDK locale when the caller
does not provide a `locale` query value. It does not convert an all-locale client or Sync API
payload back into the single-locale shape.

## Why the SDKs resolve one Contentful locale

Entry personalization joins two independent data sets:

- Contentful returns the baseline entry, optimization entries, and variant entries.
- The Experience API returns selected optimization metadata for the profile or request.

The local resolver then reads fields such as `fields.nt_experiences` and `fields.nt_variants`
directly from that Contentful payload. If those fields are locale-keyed maps, the resolver cannot
know which locale branch the application intends to render. Resolving one Contentful locale before
the CDA request keeps the resolver deterministic, typed, and independent of application routing.

SDK-assisted locale resolution also avoids using raw browser, device, or request locales directly as
CDA query values. Runtime locales can differ from Contentful locale codes in casing, separators,
script subtags, market variants, or availability. A browser might report `de-AT` while the
Contentful space supports only `de-DE`. The SDK matches runtime input to the configured Contentful
locale list and returns the configured code that the CDA understands.

The SDKs preserve configured Contentful locale codes in their outputs. Matching is case-insensitive,
but a configured value such as `en-US` remains `en-US` when exposed as `optimization.locale`,
`client.locale`, or `contentfulLocale`.

## SDK locale configuration

SDK locale configuration centers on `contentfulLocales` and an optional initial app/content
`locale`:

```ts
const optimization = new ContentfulOptimization({
  clientId,
  environment,
  contentfulLocales: {
    default: 'en-US',
    supported: ['en-US', 'de-DE', 'fr-FR'],
  },
  locale: 'de-AT',
})
```

Native SDKs expose the same model with platform-specific syntax:

```swift
let config = OptimizationConfig(
    clientId: clientId,
    contentfulLocales: ContentfulLocales(
        default: "en-US",
        supported: ["en-US", "de-DE", "fr-FR"]
    ),
    locale: "de-AT"
)
```

```kotlin
val config = OptimizationConfig(
    clientId = clientId,
    contentfulLocales = ContentfulLocales(
        default = "en-US",
        supported = listOf("en-US", "de-DE", "fr-FR"),
    ),
    locale = "de-AT",
)
```

Copy `default` and `supported` from Contentful locale settings or the locale list returned by the
Content Management API. The SDK does not discover the locale list automatically.

### Resolution modes

Locale resolution has these common configuration cases:

| Configuration                                             | Resolved Contentful locale                     | Result                                                                                                                      |
| --------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| No `contentfulLocales` and no explicit top-level `locale` | `undefined`                                    | SDK-assisted CDA locale resolution is disabled. Wrapped CDA clients omit `locale` and Contentful uses the space default.    |
| No `contentfulLocales` with explicit top-level `locale`   | Normalized explicit locale                     | The SDK uses the explicit locale as-is after validation. The application is responsible for ensuring the space supports it. |
| `contentfulLocales.default` only                          | `contentfulLocales.default`                    | Single-locale apps get a concrete CDA locale and default Experience API locale.                                             |
| `contentfulLocales.default` and `supported`               | Matched configured locale, or default fallback | Localized apps can match browser, device, route, or request candidates to supported Contentful locale codes.                |

Use default-only configuration for an app that always renders one Contentful locale. Add `supported`
when the app needs to match runtime or request locales to multiple configured Contentful locales.

### Candidate matching

When `contentfulLocales` is configured, the SDK resolves candidates in this order:

1. If an explicit top-level `locale` or runtime `setLocale()` value exists, use it as the only
   candidate.
2. Otherwise, collect runtime, device, or request candidates for the environment.
3. Try exact configured locale matches across all candidates first.
4. Try progressively shorter language or script fallback matches by `supported` order.
5. Return `contentfulLocales.default` when no candidate matches.

Exact matches across all candidates win before language-level fallback. For example, with
`supported: ['en-US', 'de-DE', 'fr-FR']` and request candidates `['fr-CA', 'de-DE']`, the SDK
returns `de-DE` because it is an exact configured match. It does not return `fr-FR` merely because
`fr-CA` appears first.

The order of `supported` matters for broad fallback. If the runtime candidate is `de-AT` and the
space supports both `de-DE` and `de-CH`, the first matching `de-*` locale in `supported` wins.

### Validation

The SDK normalizes locale candidates by trimming whitespace and converting underscores to hyphens
before matching. Matching ignores case, but resolved values preserve configured Contentful locale
code casing.

Ambient runtime candidates such as browser languages, device languages, and `Accept-Language` header
values are ignored when they are not valid locale strings. Explicit locale inputs are stricter:

- `contentfulLocales.default` and `contentfulLocales.supported` must be valid locale strings.
- Top-level `locale` must be a valid locale string when present.
- `setLocale(locale)` must receive a valid locale string.
- Explicit CDA query `locale` values passed through `withOptimizationLocale()` must be valid locale
  strings.
- `api.locale` must be a valid locale string when present.

The wildcard value `*` is intentionally not a valid explicit SDK locale. Use a concrete locale for
entries that feed Optimization SDK entry resolution.

## Runtime behavior

Each SDK uses the same matching rules, but the candidate source differs by runtime.

### Browser and React Web

The Web SDK and React Web SDK are stateful browser runtimes. They collect locale candidates from
`navigator.languages` and `navigator.language` unless the application provides an explicit top-level
`locale`.

The resolved locale is exposed through `optimization.locale` and `optimization.states.locale`.
`withOptimizationLocale(contentfulClient)` injects that locale into `getEntry()` and `getEntries()`
when the caller does not provide a locale. React Web exposes the same helper through
`useOptimization()`.

Use `optimization.setLocale(nextLocale)` when application language state changes after
initialization. In React Web provider-owned instances, changing the provider `locale` prop calls
`setLocale(nextLocale)` for you. The method updates SDK locale state and the default Experience API
locale when `api.locale` is not configured. It does not refetch Contentful entries, rerun routing
loaders, or refresh profile data.

For route-based localization, pass the route locale as the explicit `locale` candidate. Browser
language preferences are a fallback input, not a replacement for application routing policy.

### Node and SSR

The Node SDK is stateless. It does not store a current request locale between calls. Call
`resolveRequestLocale(reqOrAcceptLanguage)` for each request.

That method accepts a raw `Accept-Language` header or a request-like object. It parses quality
weights, ignores invalid candidates, and returns:

```ts
const { contentfulLocale, eventLocale } = optimization.resolveRequestLocale(req)
```

Use the returned values for different purposes:

| Value              | Use                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------ |
| `contentfulLocale` | CDA entry fetches and the per-call Experience API `{ locale }` option, when present. |
| `eventLocale`      | Event payload context, for example `page({ locale: eventLocale, ... })`.             |

When `contentfulLocales` is not configured, `contentfulLocale` is absent. Omit CDA and Experience
API locale options intentionally and let those APIs use their defaults. Do not substitute
`eventLocale` as a CDA locale unless your application has separately verified that it is a
configured Contentful locale.

Server-rendered pages must keep the request-scoped locale with the request-scoped profile and
optimization data. Cache raw Contentful payloads by locale if needed; don't cache a profile-resolved
entry variant as a global response for another locale or visitor.

### React Native

The React Native SDK is stateful and uses `Intl.DateTimeFormat().resolvedOptions().locale` as its
runtime locale candidate unless the application provides an explicit `locale`.

The resolved locale is exposed through `optimization.locale` and `optimization.states.locale`.
`withOptimizationLocale(contentfulClient)` works the same way as in the Web SDK for `contentful.js`
clients used by the React Native application layer.

In provider-owned instances, changing the provider `locale` prop calls `setLocale(nextLocale)` after
initialization. Locale changes update SDK state, but the app must run its normal `screen()`,
`identify()`, and Contentful refetch flow when localized data needs to change.

### iOS and Android

The native SDKs use the shared JavaScript core through a native bridge. Swift and Kotlin expose the
same locale model as the JavaScript SDKs.

| Runtime | Candidate source                                                       | Resolved locale surface | Contentful fetch responsibility                |
| ------- | ---------------------------------------------------------------------- | ----------------------- | ---------------------------------------------- |
| iOS     | `Locale.preferredLanguages`, unless `OptimizationConfig.locale` is set | `client.locale`         | The app-owned CDA client uses `client.locale`. |
| Android | `LocaleList.getDefault()`, unless `OptimizationConfig.locale` is set   | `client.locale`         | The app-owned CDA client uses `client.locale`. |

Native SDKs do not fetch Contentful entries for the app layer. Use `client.locale` in your CDA
request code before passing entries to `OptimizedEntry` or `personalizeEntry(...)`.

Runtime language changes use `OptimizationClient.setLocale(...)`. Like the JavaScript SDKs, this
updates SDK locale state and the default Experience API locale when no explicit API override exists.
It does not fetch new Contentful entries for the application.

## Experience API localization

The Experience API has its own `locale` query parameter. In the Optimization SDK Suite, that locale
is not a CDA locale switch. It can localize Experience API response values, including profile
location fields used by merge tags such as `location.city` and `location.country`.

Stateful SDKs choose the Experience API request locale this way:

1. Use explicit `api.locale` when configured.
2. Otherwise, use the SDK-resolved Contentful locale when present.
3. Otherwise, omit the locale query parameter and let the Experience API use its default.

Stateless Node code passes the Experience API locale per request:

```ts
const { contentfulLocale, eventLocale } = optimization.resolveRequestLocale(req)
const requestOptions = contentfulLocale ? { locale: contentfulLocale } : undefined

const data = await optimization.page(
  {
    locale: eventLocale,
    profile: { id: profileId },
    properties: { path: req.path },
  },
  requestOptions,
)
```

Use the same resolved Contentful locale for CDA and Experience API requests when merge tags must
render profile values in the same language as the entry. Configure `api.locale` only when the
Experience API response language must intentionally differ from the Contentful content language.

Event context locale is separate. It describes the event context for analytics and audience rules,
but it does not choose the Contentful entry locale and does not override the Experience API query
parameter.

## Entry resolution and localized Contentful content

The entry resolver expects one localized Contentful payload. Fetch the baseline entry with the
resolved Contentful locale and enough include depth for linked optimization and variant entries:

```ts
const contentful = optimization.withOptimizationLocale(contentfulClient)

const baselineEntry = await contentful.getEntry(entryId, {
  include: 10,
})
```

The resolver works with direct field values such as:

```ts
entry.fields.nt_experiences
optimizationEntry.fields.nt_variants
```

It does not read locale-keyed values such as:

```ts
entry.fields.nt_experiences['en-US']
optimizationEntry.fields.nt_variants['en-US']
```

Contentful locale fallback can affect the fields the resolver sees. If a localized `nt_experiences`
field is empty and falls back to another configured locale, the SDK resolves against that delivered
fallback value. If Contentful returns no usable optimization links for the requested locale, SDK
entry resolution returns the baseline entry.

## Application responsibilities

The SDKs deliberately leave several locale decisions to the application:

- Choose the application route or UI locale.
- Decide when to use browser or device preferences and when to use an app-selected locale.
- Keep `contentfulLocales` aligned with the locales configured in the Contentful environment.
- Fetch Contentful entries and assets with the resolved Contentful locale.
- Refresh Contentful data and Experience API profile data after a runtime locale change.
- Decide cache keys for Contentful payloads, Experience API responses, and rendered pages.
- Decide whether `api.locale` must intentionally differ from the Contentful locale.

This separation keeps SDK behavior predictable across web, server, React Native, iOS, and Android
runtimes without requiring the SDKs to own application routing or Contentful client setup.

## Caveats and gotchas

- **All-locale payloads don't resolve** - `contentful.js` `withAllLocales`, raw CDA `locale=*`, and
  Sync API all-locale payloads return locale-keyed field maps. Use one concrete CDA locale for
  entries passed to Optimization SDK entry resolution.
- **`contentfulLocales` is configuration, not discovery** - The SDK does not fetch the space locale
  list. Update SDK configuration when Contentful locale settings change.
- **`supported` order affects broad fallback** - Exact configured matches win first, but language
  fallback chooses the first matching configured locale by `supported` order.
- **Runtime locale is only a candidate** - Browser, device, and `Accept-Language` values can be
  unsupported by Contentful. The SDK maps them to configured codes when `contentfulLocales` exists.
- **Explicit locale without `contentfulLocales` is trusted** - The SDK validates syntax but cannot
  know whether the Contentful space supports that locale.
- **`setLocale()` does not fetch** - Locale changes update SDK state and default Experience API
  locale. The app must refetch Contentful content and call Experience methods again when rendered
  data needs to change.
- **`api.locale` is not the CDA locale** - It controls the Experience API request locale. If it
  differs from the Contentful locale, merge tag profile values can render in a different language
  than the entry content.
- **`eventLocale` is event data** - In Node and SSR, use `contentfulLocale` for CDA and Experience
  API request options. Use `eventLocale` only in event payload context unless the application has
  validated it separately.
- **Caller-supplied CDA locale wins** - `withOptimizationLocale()` does not overwrite a caller's
  explicit `locale` query value. It validates that value and injects the SDK locale only when the
  query omits `locale`.
- **Contentful fallback can hide missing localized optimization fields** - A localized entry can
  still resolve if Contentful falls back `nt_experiences` or variant fields to another locale.
  Verify fallback rules when personalization links differ by market.

## Related documentation

- [Entry personalization and variant resolution](./entry-personalization-and-variant-resolution.md)
  explains how single-locale Contentful entries are resolved to selected variants.
- [Profile synchronization between client and server](./profile-synchronization-between-client-and-server.md)
  explains how browser and server runtimes share profile and request context.
- [Interaction tracking in Node and stateless environments](./interaction-tracking-in-node-and-stateless-environments.md)
  explains how event context locale works in server-side tracking.
- [Contentful localization strategies](https://www.contentful.com/help/localization/field-and-entry-localization/)
  explains Contentful localization models and fallback behavior.
- [Manage locales in Contentful](https://www.contentful.com/help/localization/manage-locales/)
  explains locale codes, fallback locales, and API response settings.
- [Content Delivery API localization](https://www.contentful.com/developers/docs/references/content-delivery-api/#/reference/localization)
  explains the CDA `locale` query parameter and `locale=*` response shape.
- [`contentful.js` client chain modifiers](https://github.com/contentful/contentful.js#client-chain-modifiers)
  explain single-locale and all-locale client behavior.
- [Experience API](https://www.contentful.com/developers/docs/personalization/experience-api/)
  documents the Experience API profile endpoints and request `locale` option.
