---
title: Locale handling in the Optimization SDK Suite
---

# Locale handling in the Optimization SDK Suite

Use this document to keep the application Contentful locale separate from the SDK Experience/event
locale. The SDKs do not resolve Contentful locales, wrap CDA clients, or infer browser, device, or
request locales. Applications choose their own locale from routing, i18n, native state, or request
logic and pass it to each system that needs it.

For entry replacement mechanics, see
[Entry personalization and variant resolution](./entry-personalization-and-variant-resolution.md).
For package setup, use the relevant integration guide or package README.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [The locale channels](#the-locale-channels)
- [Application Contentful locale](#application-contentful-locale)
- [SDK Experience and event locale](#sdk-experience-and-event-locale)
- [Stateful SDKs](#stateful-sdks)
- [Node and stateless SDKs](#node-and-stateless-sdks)
- [Entry resolution and localized Contentful content](#entry-resolution-and-localized-contentful-content)
- [Application responsibilities](#application-responsibilities)
- [Related documentation](#related-documentation)

<!-- mtoc-end -->
</details>

## The locale channels

Locale handling in an optimized application has two application-facing channels.

| Channel                       | Owned by                                                           | Used for                                                                                        |
| ----------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Application Contentful locale | Application router, i18n layer, request logic, or native app state | CDA/CPA `locale` query values, UI language, route language, cache keys, and content refetching. |
| SDK Experience/event locale   | Optimization SDK configuration or request options                  | Experience API `locale` query values and default event context locale.                          |

The same string is often used for both channels, but the SDK treats them as separate inputs. The SDK
does not know which Contentful locales are enabled in a space and does not validate that an SDK
locale is supported by Contentful.

## Application Contentful locale

Applications fetch Contentful entries directly. Choose an `appLocale` with application-owned logic,
then pass it to CDA or CPA calls:

```ts
const appLocale = getAppLocale()

const entry = await contentfulClient.getEntry(entryId, {
  include: 10,
  locale: appLocale,
})
```

Do this anywhere Contentful content is fetched: browser data loaders, React hooks, server routes,
React Native services, and native app content clients. If the app omits `locale`, Contentful uses
the space default locale.

Use the same `appLocale` in cache keys when localized content can differ:

```ts
const cacheKey = `${appLocale}:${entryId}`
```

## SDK Experience and event locale

Stateful SDKs accept top-level `locale` as the default SDK Experience/event locale:

```ts
const appLocale = getAppLocale()

const optimization = new ContentfulOptimization({
  clientId,
  locale: appLocale,
})
```

That value initializes the SDK locale state, sets the default Experience API request locale, and
provides the default event context locale. If `locale` is omitted, the Experience API locale query
is omitted by default. Event payloads can still use the event-builder fallback required by the event
schemas.

The low-level Experience API client still supports its own default and per-request `locale` options.
Use those only when calling the low-level API client directly or when an advanced stateless request
needs a pass-through.

## Stateful SDKs

Web, React Web, React Native, iOS, and Android keep live locale state:

- JavaScript SDKs expose `optimization.locale`, `optimization.states.locale`, and
  `optimization.setLocale(locale)`.
- React providers update provider-owned SDK instances when their `locale` prop changes.
- Native SDKs expose `client.locale`, native state locale, and `setLocale(...)`.

`setLocale(locale)` validates and normalizes the SDK Experience/event locale. It does not refetch
Contentful content, update routes, or clear application caches. Application code must refetch
Contentful entries with its chosen Contentful locale.

```ts
const nextLocale = getAppLocaleFromRoute()

optimization.setLocale(nextLocale)

const entry = await contentfulClient.getEntry(entryId, {
  include: 10,
  locale: nextLocale,
})
```

## Node and stateless SDKs

Node and other stateless environments bind locale per request with `forRequest({ locale })`:

```ts
const appLocale = getAppLocale(request)

const requestOptimization = optimization.forRequest({
  consent: true,
  locale: appLocale,
  eventContext: {
    page: getPageContext(request),
    userAgent: request.headers.get('user-agent') ?? 'server',
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

## Entry resolution and localized Contentful content

Entry resolution expects one localized view of a baseline entry and linked optimization entries.
Pass direct single-locale field values to `resolveOptimizedEntry()`, `OptimizedEntry`,
`useEntryResolver()`, or native entry helpers. Do not pass all-locale CDA responses from
`withAllLocales` or `locale=*`.

The SDK does not mutate application Contentful clients or infer when a content refetch is needed.
When route or language state changes, the application should update SDK locale state, refetch
Contentful content with the app locale, and invalidate app caches as needed.

## Application responsibilities

Applications own:

- Choosing the application Contentful locale from routes, request context, i18n state, or native app
  state.
- Passing the Contentful locale to CDA/CPA requests.
- Passing the SDK Experience/event locale through top-level SDK `locale`, provider `locale`, native
  config `locale`, or Node `forRequest({ locale })`.
- Keeping localized content cache keys distinct.
- Refetching Contentful content after locale changes.
- Ensuring the Contentful locale is supported by the target Contentful environment.

## Related documentation

- [Entry personalization and variant resolution](./entry-personalization-and-variant-resolution.md)
- [Integrating the Web SDK in a web app](../guides/integrating-the-web-sdk-in-a-web-app.md)
- [Integrating the React Web SDK in a React app](../guides/integrating-the-react-web-sdk-in-a-react-app.md)
- [Integrating the Node SDK in a Node app](../guides/integrating-the-node-sdk-in-a-node-app.md)
