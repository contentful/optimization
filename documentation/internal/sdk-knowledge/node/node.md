# Node (`@contentful/optimization-node`) — SDK knowledge

<!-- feeds-guides: documentation/guides/integrating-the-node-sdk-in-a-node-app.md -->

> Internal, verified reference. Not a guide. Facts only, each with a source pointer. Last verified
> against packages/\*\*/src during the guide rewrite.

Shared vocabulary and SDK-neutral concepts: see [`../shared/vocabulary.md`](../shared/vocabulary.md)
and [`../shared/concepts.md`](../shared/concepts.md). This file records only Node-SDK specifics.
Stateless server SDK: a process-level `ContentfulOptimization` class + a request-bound
`CoreStatelessRequest` client created by `forRequest()`. NOT React and NOT stateful; it holds no
per-visitor state between requests. Package source root: `packages/node/node-sdk/src`; shared core:
`packages/universal/core-sdk/src`. The Node class is a thin defaults wrapper over `CoreStateless`.

## Package & entry points

| Import path                                      | Purpose                                                                                                                                                      | source                                                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `@contentful/optimization-node` (default export) | Node `ContentfulOptimization` class (extends `CoreStateless`)                                                                                                | node-sdk#index.ts; node-sdk#ContentfulOptimization.ts#ContentfulOptimization                                                   |
| `@contentful/optimization-node` (named)          | `OPTIMIZATION_NODE_SDK_NAME`, `OPTIMIZATION_NODE_SDK_VERSION`, `OptimizationNodeConfig`, `PublicNodeEventBuilderConfig`                                      | node-sdk#index.ts; node-sdk#constants.ts#OPTIMIZATION_NODE_SDK_NAME; node-sdk#ContentfulOptimization.ts#OptimizationNodeConfig |
| `@contentful/optimization-node/constants`        | `ANONYMOUS_ID_COOKIE`, `ANONYMOUS_ID_KEY`, Node SDK name/version                                                                                             | node-sdk#constants.ts; core-sdk#constants.ts#ANONYMOUS_ID_COOKIE; core-sdk#constants.ts#ANONYMOUS_ID_KEY                       |
| `@contentful/optimization-node/core-sdk`         | Re-exports all of core-sdk (incl. `UniversalEventBuilderArgs`, `CoreStateless`, `CoreStatelessRequest`) plus `prefetchOptimizedEntries` entry-source helpers | node-sdk#core-sdk.ts; core-sdk#events/EventBuilder.ts#UniversalEventBuilderArgs                                                |
| `@contentful/optimization-node/api-schemas`      | Schemas + type guards incl. `isMergeTagEntry`                                                                                                                | node-sdk#api-schemas.ts; api-schemas#contentful/typeGuards.ts#isMergeTagEntry                                                  |
| `@contentful/optimization-node/api-client`       | API client re-export                                                                                                                                         | node-sdk#api-client.ts                                                                                                         |
| `@contentful/optimization-node/logger`           | logger utilities (default + named)                                                                                                                           | node-sdk#logger.ts                                                                                                             |

## Setup / factory

- `new ContentfulOptimization(config)` — extends `CoreStateless extends CoreBase`; stateless. Create
  ONE per process/module and reuse across requests. Constructing it does NOT attach to any global and
  does NOT throw on a second instance (unlike the stateful Web SDK). Node defaults applied by the
  constructor: `eventBuilder.channel: 'server'`, `eventBuilder.library` = Node SDK name/version,
  `eventBuilder.getConsent: () => false` (per-request consent is bound with `forRequest()`, never on
  the singleton), and `allowedEventTypes` defaults to `['identify', 'page']` when omitted.
  source: node-sdk#ContentfulOptimization.ts#ContentfulOptimization; node-sdk#ContentfulOptimization.ts#DEFAULT_NODE_ALLOWED_EVENT_TYPES
- Config type `OptimizationNodeConfig` = `Omit<CoreStatelessConfig, 'eventBuilder'>` plus `app?: App`
  and `eventBuilder?: PublicNodeEventBuilderConfig`; the Node `eventBuilder` override omits `app`,
  `getConsent`, and (via `CoreStatelessConfig`) `getLocale`/`getPageProperties`/`getUserAgent`.
  source: node-sdk#ContentfulOptimization.ts#OptimizationNodeConfig; node-sdk#ContentfulOptimization.ts#PublicNodeEventBuilderConfig; core-sdk#CoreStateless.ts#CoreStatelessConfig
- Config keys (verified):
  - `clientId` (required, `string`), `environment` (optional; API default `'main'`).
    source: api-client#ApiClientBase.ts#ApiConfig; api-client#ApiClientBase.ts#GlobalApiConfigProperties
  - `locale`, `logLevel` (`'fatal'|'error'|'warn'|'info'|'debug'|'log'`).
    source: core-sdk#CoreBase.ts#CoreConfig; api-client#lib/logger/logging.ts#LogLevels
  - `api.experienceBaseUrl` / `api.insightsBaseUrl` / `api.enabledFeatures` — base URLs default
    correctly; set only for mocks/non-default hosts.
    source: core-sdk#CoreApiConfig.ts#CoreSharedApiConfig; core-sdk#CoreApiConfig.ts#CoreStatelessApiConfig
  - `app.name` / `app.version` (both required strings when `app` is given; whole object optional).
    source: api-schemas#experience/event/properties/App.ts#App
  - `allowedEventTypes` (pre-consent allow-list), `onEventBlocked` (blocked-event diagnostics).
    source: core-sdk#CoreStateless.ts#CoreStatelessConfig; core-sdk#CoreStateless.ts#CoreStateless
  - `contentful?: ContentfulConfig` (managed entry fetching) — same shape/semantics as the web
    family; see [`../shared/concepts.md`](../shared/concepts.md#entry-source-boundary-managed-or-manual).
    source: core-sdk#CoreBase.ts#ContentfulConfig
- `forRequest(options)` → returns a new `CoreStatelessRequest`. This is the ONLY place event methods
  live; the singleton exposes no event methods. `options` = `CoreStatelessForRequestOptions`:
  `consent` (required), `locale?`, `profile?: PartialProfile`,
  `eventContext?: UniversalEventBuilderArgs`, `experienceOptions?`, `insightsOptions?`.
  source: core-sdk#CoreStateless.ts#forRequest; core-sdk#CoreStatelessRequest.ts#CoreStatelessForRequestOptions

## Components & hooks

None. Node is an imperative class (`ContentfulOptimization`) plus a request-bound client
(`CoreStatelessRequest`); no React components, hooks, providers, or Web Components.
source: node-sdk#ContentfulOptimization.ts#ContentfulOptimization; core-sdk#CoreStatelessRequest.ts#CoreStatelessRequest

## Render / entry resolution

- Entry-source boundary (manual vs managed), single-locale requirement, and baseline fallback are
  shared: see [`../shared/concepts.md`](../shared/concepts.md#entry-source-boundary-managed-or-manual)
  and [`../shared/concepts.md`](../shared/concepts.md#entry-resolution).
- Synchronous singleton `resolveOptimizedEntry(baselineEntry, selectedOptimizations?)` →
  `ResolvedData` `{ entry, selectedOptimization?, optimizationContextId?, isEmptyVariant? }`. On the
  singleton there is no ambient state: omitting `selectedOptimizations` yields the baseline, so pass
  it explicitly for personalized content.
  source: core-sdk#CoreBase.ts#resolveOptimizedEntry; core-sdk#resolvers/OptimizedEntryResolver.ts#ResolvedData
- Request-bound `fetchOptimizedEntry(entryId, options?)` → `FetchOptimizedEntryResult`
  `{ baselineEntry, entry, selectedOptimization?, optimizationContextId?, isEmptyVariant? }`. When
  `options.selectedOptimizations` is omitted it defaults to the latest selections returned by an
  accepted request-bound Experience call (`page()`/`identify()`); when neither
  `contentful.defaultQuery.locale` nor the per-call `query.locale` is set, the request's `locale`
  becomes the managed Contentful query locale.
  source: core-sdk#CoreStatelessRequest.ts#fetchOptimizedEntry; core-sdk#CoreStatelessRequest.ts#withRequestContentfulLocale; core-sdk#CoreBase.ts#FetchOptimizedEntryResult
- Request-bound `fetchContentfulEntry(entryId, query?)` fetches the baseline only (same locale
  injection); throws if `contentful.client` is not configured. Managed-cache mechanics and the
  `defaultQuery`+per-call+locale+`include: 10` merge are shared.
  source: core-sdk#CoreStatelessRequest.ts#fetchContentfulEntry; core-sdk#CoreBase.ts#fetchContentfulEntry
- `selectedOptimization` fields: `experienceId`, `variantIndex`, `variants` (baseline-entry-id →
  variant-entry-id map), `sticky`. `variants[baselineEntryId]` equal to the baseline id means baseline.
  source: api-schemas#experience/optimization/SelectedOptimization.ts#SelectedOptimization
- `getFlag(name, changes?)` → resolves a flag value from a `changes` list; read-only, no side effect.
  `getMergeTagValue(mergeTagEntry, profile?)` → resolves a MergeTag value against the request profile,
  falling back to the entry's configured fallback.
  source: core-sdk#CoreBase.ts#getFlag; core-sdk#CoreBase.ts#getMergeTagValue; core-sdk#resolvers/MergeTagValueResolver.ts#MergeTagValueResolver

## Identifier ownership

| Identifier                                            | Owner  | Notes                                                                                                                                                                                                                                                  | source                                                                                                                    |
| ----------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `ctfl-opt-aid` (`ANONYMOUS_ID_COOKIE`)                | reader | The SDK exports the constant but manages NO cookies in Node; the app reads/writes/clears it and passes the id via `forRequest({ profile })`. Value === `'ctfl-opt-aid'`. Keep non-`HttpOnly` in a hybrid Node+Web app so browser SDK code can read it. | core-sdk#constants.ts#ANONYMOUS_ID_COOKIE; node-sdk#constants.ts                                                          |
| request `profile` (`PartialProfile`, `{ id }` + JSON) | reader | Bound per request via `forRequest({ profile })`; the request client's `profile` getter updates after an Experience response.                                                                                                                           | core-sdk#CoreStatelessRequest.ts#CoreStatelessForRequestOptions; api-schemas#experience/profile/Profile.ts#PartialProfile |
| request `consent` decision                            | reader | App reads its own CMP/cookie/session; SDK only receives the per-request decision.                                                                                                                                                                      | core-sdk#CoreStatelessRequest.ts#CoreStatelessRequestConsent                                                              |
| env/config values                                     | reader | SDK config is framework-agnostic; app owns the env-var convention (e.g. `PUBLIC_...`, `process.env`).                                                                                                                                                  | extern:app owns server runtime config values                                                                              |

## Events & tracking

- Request-bound event methods (on `CoreStatelessRequest`, awaited): Experience methods `page(payload?)`
  (payload defaults `{}`), `identify({ userId, traits? })` (`userId` required), `screen({ name, properties })`,
  `track({ event, properties? })` (`event` required) → return `EventEmissionResult`
  `{ accepted, data? }` where `data` is `OptimizationData` `{ profile, selectedOptimizations, changes }`.
  Accepted `page()`/`identify()` update the request client's `profile` and cached
  `selectedOptimizations`.
  source: core-sdk#CoreStatelessRequest.ts#page; core-sdk#CoreStatelessRequest.ts#identify; core-sdk#CoreStatelessRequest.ts#screen; core-sdk#CoreStatelessRequest.ts#track; core-sdk#events/EventEmissionResult.ts#EventEmissionResult; api-schemas#experience/ExperienceResponse.ts#OptimizationData
- Insights methods: `trackView(payload)` returns `EventEmissionResult`; `trackClick`, `trackHover`,
  `trackFlagView` return `void`. `trackView({ componentId, viewId, viewDurationMs, experienceId?, variantIndex?, sticky? })`.
  source: core-sdk#CoreStatelessRequest.ts#trackView; core-sdk#CoreStatelessRequest.ts#trackClick; core-sdk#CoreStatelessRequest.ts#trackHover; core-sdk#CoreStatelessRequest.ts#trackFlagView; core-sdk#events/EventBuilder.ts#ViewBuilderArgs
- Sticky `trackView` (`sticky: true`) sends an Experience `component` view FIRST, then reuses that
  response's `profile` for the paired Insights view. Non-sticky `trackView`, `trackClick`,
  `trackHover`, and `trackFlagView` throw if no request-bound `profile.id` exists (there is no ambient
  profile). The thrown text is method-specific (e.g. "trackView() requires a request-bound profile id
  when payload.sticky is not true").
  source: core-sdk#CoreStatelessRequest.ts#trackView; core-sdk#CoreStatelessRequest.ts#NON_STICKY_TRACK_VIEW_PROFILE_ERROR; core-sdk#CoreStatelessRequest.ts#TRACK_CLICK_PROFILE_ERROR
- `getFlag()` never emits a flag view. To report a flag exposure, call request-bound `trackFlagView`
  (admitted when request event consent is `true` OR `'flag'`/`'component'` is allow-listed; requires a
  bound profile). Node's default allow-list does NOT include `'flag'`/`'component'`.
  source: core-sdk#CoreBase.ts#getFlag; core-sdk#CoreStatelessRequest.ts#trackFlagView; core-sdk#CoreStatelessRequest.ts#hasConsent
- Consent gate: an event is admitted when the request event consent is `true`, OR its selector is in
  the SDK's `allowedEventTypes`. With Node's `['identify', 'page']` default, `page()`/`identify()` are
  admitted before event consent and are labeled `context.gdpr.isConsentGiven: false`; setting
  `allowedEventTypes: []` blocks them until request consent is `true`. Event-type wire strings:
  `identify`, `page`, `screen`, `track`, `component` (view/flag view), `component_click`,
  `component_hover`; `flag` is a consent selector only.
  source: core-sdk#CoreStatelessRequest.ts#hasConsent; core-sdk#CoreStatelessRequest.ts#withRequestEventConsent; core-sdk#events/EventType.ts#AllowedEventType; node-sdk#ContentfulOptimization.ts#DEFAULT_NODE_ALLOWED_EVENT_TYPES
- Blocked events do NOT throw: Experience methods return `{ accepted: false }`, Insights methods
  return without sending; `onEventBlocked({ reason: 'consent', method, args })` fires for diagnostics.
  source: core-sdk#CoreStatelessRequest.ts#sendExperienceEvent; core-sdk#CoreStatelessRequest.ts#reportBlockedEvent; core-sdk#events/BlockedEvent.ts#BlockedEvent
- `eventContext` (`UniversalEventBuilderArgs`: `locale?`, `userAgent?`, `page?`, `screen?`, `campaign?`,
  `location?`) is merged into every event built through the request client; a per-call payload wins over
  it. `page.*` requires `path`, `query`, `referrer`, `search`, `url` (`title` optional).
  source: core-sdk#CoreStatelessRequest.ts#withEventContext; core-sdk#events/EventBuilder.ts#UniversalEventBuilderArgs; api-schemas#experience/event/properties/Page.ts#Page

## Consent & persistence

- Request-scoped, not stateful. `forRequest({ consent })` accepts `boolean` or
  `{ events?, persistence? }` (`CoreStatelessRequestConsent`). `events` gates event emission;
  `persistence === true` sets the request client's `canPersistProfile` flag the app checks before
  persisting the returned `profile.id`. A boolean sets both axes.
  source: core-sdk#CoreStatelessRequest.ts#CoreStatelessRequestConsent; core-sdk#CoreStatelessRequest.ts#canPersistProfile
- The SDK stores nothing between requests: no consent cookie, no profile cookie, no CMP record. The
  app owns all persistence; the SDK only reads the per-request `consent` and `profile`. General
  consent-vs-persistence model: see
  [`../shared/concepts.md`](../shared/concepts.md#consent--persistence).
  source: core-sdk#CoreStatelessRequest.ts#CoreStatelessRequest

## Version / runtime quirks

- Stateless per request: construct the SDK once, call `forRequest()` per incoming request, then call
  event methods / entry fetches on that request client. The request client's `profile` getter is the
  only mutable request-local state and updates only from accepted Experience responses.
  source: core-sdk#CoreStatelessRequest.ts#CoreStatelessRequest; core-sdk#CoreStatelessRequest.ts#sendAllowedExperienceEvent
- Locale precedence: when `forRequest()` receives both a top-level `locale` and
  `experienceOptions.locale`, the top-level request `locale` wins — the constructor rewrites
  `experienceOptions.locale` (and `eventContext.locale`) to the normalized request locale.
  source: core-sdk#CoreStatelessRequest.ts#CoreStatelessRequest; core-sdk#locale.ts#normalizeExplicitLocale
- Request-scoped API options: `experienceOptions` (`CoreStatelessRequestOptions`: `ip`, `locale`,
  `plainText`, `preflight`) and `insightsOptions` (`CoreStatelessInsightsOptions`: `beacon`) apply only
  to that request's calls.
  source: core-sdk#CoreStateless.ts#CoreStatelessRequestOptions; core-sdk#CoreStateless.ts#CoreStatelessInsightsOptions
- SDK config is framework-agnostic; store the instance in a module-level singleton. No browser live
  updates or preview UI in Node.
  source: node-sdk#ContentfulOptimization.ts#ContentfulOptimization

## Failure & fallback behavior

- Baseline fallback on no selections / entry not optimized / no matching optimization entry / no
  matching selection / broken variant link / all-locale payload: the resolver returns the baseline
  entry. Shared model: see [`../shared/concepts.md`](../shared/concepts.md#baseline-fallback).
  source: core-sdk#resolvers/OptimizedEntryResolver.ts#resolveWithContext
- Consent-blocked events fail closed without throwing (see Events & tracking). Insights-only calls
  and non-sticky `trackView` without a bound `profile.id` throw a method-specific error; sticky
  `trackView` throws only if it cannot derive a profile from its Experience response and none was bound.
  source: core-sdk#CoreStatelessRequest.ts#requireInsightsProfile; core-sdk#CoreStatelessRequest.ts#STICKY_TRACK_VIEW_PROFILE_ERROR
- Validation: `pnpm implementation:run -- node-sdk typecheck`; reference implementations exercise
  `page()`, `identify()`, `resolveOptimizedEntry()`, `getMergeTagValue()`, and `ANONYMOUS_ID_COOKIE`
  cookie sharing.
  source: impl:node-sdk#package.json; impl:node-sdk+web-sdk#src/app.ts
