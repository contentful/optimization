# Web (`@contentful/optimization-web`) — SDK knowledge

> Internal, verified reference. Not a guide. Facts only, each with a source pointer. Last verified
> against packages/\*\*/src during the guide rewrite.

Shared vocabulary and SDK-neutral concepts: see [`../shared/vocabulary.md`](../shared/vocabulary.md)
and [`../shared/concepts.md`](../shared/concepts.md). This file records only Web-SDK specifics.
Imperative `ContentfulOptimization` class + optional Web Components (NOT React; the React Web SDK
wraps this). Package source root: `packages/web/web-sdk/src`; shared core:
`packages/universal/core-sdk/src`; preview panel: `packages/web/preview-panel/src`.

## Package & entry points

| Import path                                     | Purpose                                                         | source                                                                            |
| ----------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `@contentful/optimization-web` (default export) | `ContentfulOptimization` class                                  | `src/index.ts:49`; `src/ContentfulOptimization.ts:503`                            |
| `@contentful/optimization-web/web-components`   | `defineContentfulOptimizationElements()` + element/detail types | `src/web-components/index.ts:4-5,21-45`                                           |
| `@contentful/optimization-web/api-schemas`      | Type guards incl. `isMergeTagEntry`                             | `src/api-schemas.ts:1`; re-export chain → `api-schemas/src/contentful/index.ts:7` |
| `@contentful/optimization-web/constants`        | `ANONYMOUS_ID_COOKIE`, `DEFAULT_WEB_ALLOWED_EVENT_TYPES`, etc.  | `src/constants.ts:52`; `package.json` exports                                     |
| `@contentful/optimization-web/logger`           | logger utilities                                                | `package.json` exports                                                            |

## Setup / factory

- `new ContentfulOptimization(config)` — stateful; create ONE per browser runtime and reuse. In a
  browser it attaches to `window.contentfulOptimization` and **throws
  `ContentfulOptimization is already initialized`** if one already exists. `destroy()` for teardown
  only. source: `src/ContentfulOptimization.ts:290-291,375,490-500`.
- Config keys (verified):
  - `clientId`, `environment` — `api-client` `ApiClientBase.ts:33,46,54`.
  - `locale`, `logLevel` (`'warn'`/`'debug'`) — `core-sdk` `CoreBase.ts:46,54`;
    `lib/logger/logging.ts`.
  - `api.experienceBaseUrl` / `api.insightsBaseUrl` — `core-sdk` `CoreApiConfig.ts:12-15`.
  - `defaults.consent`, `defaults.persistenceConsent` — **`persistenceConsent` defaults to
    `consent`** (`persistenceConsent ?? consent`). source: `core-sdk`
    `state/StatefulDefaults.ts:85-86`.
  - `allowedEventTypes`, `queuePolicy`, `onEventBlocked` — `core-sdk` `CoreStateful.ts:184,195,197`.
  - `app.name` / `app.version` — `api-schemas/.../properties/App.ts:19,24`.
  - `cookie.domain`, `cookie.expires` (days; **default 365**) — `src/lib/cookies.ts:11-23`;
    `ContentfulOptimization.ts:58,309`.
  - `autoTrackEntryInteraction` — default `views`/`clicks`/`hovers` all `true`. source:
    `src/entry-tracking/resolveAutoTrackEntryInteractionOptions.ts:123-131`.
  - **`contentful?: ContentfulConfig` (managed entry fetching):** opt-in; from `CoreConfig`
    (`OptimizationWebConfig extends CoreStatefulConfig extends CoreConfig`).
    `{ client: ContentfulEntryClient, defaultQuery?: ContentfulEntryQuery, cache?: false |`
    `{ maxEntries?, ttlMs? } }`. `ContentfulEntryClient` =
    `{ getEntry(entryId, query?), getEntries(query?) }`;
    `ContentfulEntryQuery = EntryQueries<undefined>`. Managed query merges `defaultQuery` +
    per-entry query + SDK locale fallback + `include: 10`. One uncached normalized entry uses
    `getEntry()`; multiple uncached entries with the same normalized query use `getEntries()`;
    same-tick uncached single-entry calls with the same normalized query can share `getEntries()`;
    large `getEntries()` fetches split into 100-ID chunks. Cache default
    `{ maxEntries: 100, ttlMs: 300_000 }`; `cache: false` disables. source:
    `packages/universal/core-sdk/src/CoreBase.ts` `CoreConfig.contentful`, `ContentfulConfig`,
    `ContentfulEntryClient`, `ContentfulEntryQuery`, `fetchContentfulEntries`;
    `packages/universal/core-sdk/src/managed-entry-fetcher.ts` `ManagedEntryFetcher`;
    `packages/web/web-sdk/src/ContentfulOptimization.ts` `OptimizationWebConfig`;
    `packages/universal/core-sdk/src/CoreStateful.ts` `CoreStatefulConfig`.

## Components & hooks

None (imperative class + Web Components; no React surface). Web Components element table:

| Element / symbol                         | Kind      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | source                                                                                                                                             |
| ---------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defineContentfulOptimizationElements()` | registrar | Side-effect-free until called; registers the two custom elements                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `src/web-components/index.ts:4-5,21-45`                                                                                                            |
| `<ctfl-optimization-root>`               | element   | Attributes: `client-id`, `environment`, `locale`, `live-updates`. Properties: `defaults`, `api`, `contentful`, `trackEntryInteraction`, `sdk`, `onStatesReady`, `prefetchManagedEntries`. `contentful` is property-only and configures owned-root managed fetching. Reuses `window.contentfulOptimization` automatically if present (`this.assignedSdk ?? getGlobalSdk()`); `sdk` prop supplies an explicit instance. Root-owned SDK defaults view/click/hover on. `prefetchManagedEntries` warms the SDK-managed entry cache after the root SDK is ready. Events `ctfl-root-ready` / `ctfl-root-error`. | `packages/web/web-sdk/src/web-components/ContentfulOptimizationRootElement.ts`; `packages/web/web-sdk/src/presentation/optimizationRootRuntime.ts` |
| `<ctfl-optimized-entry>`                 | element   | Property `baselineEntry` (manual: assigning it triggers resolution) OR `entry-id` attribute / `entryId` property (managed: SDK fetches by ID via configured `contentful.client`); `entryQuery` property; `sdk`. Observed attributes: `entry-id`, `live-updates`, `track-clicks`, `track-hovers`, `track-views`. Events `ctfl-entry-loading` / `ctfl-entry-resolved` / `ctfl-entry-error`.                                                                                                                                                                                                                | `web-components/ContentfulOptimizedEntryElement.ts:76-77,92-119,197-201,253-262,16-18`                                                             |
| `ContentfulOptimizedEntryEventDetail`    | type      | `{ entry, metadata, resolvedData, selectedOptimization, selectedOptimizations, snapshot }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `ContentfulOptimizedEntryElement.ts:27-34,453-468`                                                                                                 |

## Render / entry resolution

- **Managed fetch methods (from `CoreBase`; require `contentful: { client }`):**
  - `fetchContentfulEntry(entryId, query?)` → `Promise<Entry>` — calls the configured client's
    `getEntry()` with the merged query (`defaultQuery` + per-call + locale fallback +
    `include: 10`), per-instance cached. Throws if `contentful.client` is not configured.
  - `fetchContentfulEntries(entries)` → `Promise<Entry[]>` — accepts string IDs or
    `{ entryId, entryQuery? }` descriptors; returns entries in descriptor order, including
    duplicates; batches same-query uncached entries through `getEntries()`.
  - `prefetchManagedEntries(entries)` → `Promise<ManagedEntryHandoff[]>` — fetches the same
    descriptors and returns `{ entryId, entryQuery?, baselineEntry }` handoff entries for framework
    cache warming.
  - `fetchOptimizedEntry(entryId, options?)` → `Promise<{ baselineEntry, entry,`
    `selectedOptimization?, ... }>` — fetches then resolves; `options = { query?,`
    `selectedOptimizations? }`. Additive to synchronous `resolveOptimizedEntry()`.
  - `clearContentfulEntryCache()` → clears this instance's managed-entry cache.
  - source: `packages/universal/core-sdk/src/CoreBase.ts` `clearContentfulEntryCache`,
    `fetchContentfulEntry`, `fetchContentfulEntries`, `prefetchManagedEntries`,
    `fetchOptimizedEntry`, `FetchOptimizedEntryResult`.
- `resolveOptimizedEntry(baselineEntry, selectedOptimizations?)` →
  `{ entry, selectedOptimization?, optimizationContextId? }` (public `ResolvedData` shape). Omitting
  arg 2 defaults to `selectedOptimizationsSignal.value` (current SDK state). source: `core-sdk`
  `CoreBase.ts:412-433`; `resolvers/OptimizedEntryResolver.ts:32-43`; `CoreStateful.ts:370-372`.
- `entry` is a base `contentful` `Entry` ⇒ cast `entry as YourType` (`as unknown as YourType` only
  for genuinely disjoint). Baseline fallback: see
  [`../shared/concepts.md`](../shared/concepts.md#baseline-fallback).
- **Control-variant precision (subtle):** `selectedOptimization` is `undefined` ONLY when no
  experience matched — no selections (`:148-151`), entry not optimized (`:153-156`), no optimization
  entry (`:163-168`), no matching selection (`:175-177`). When an experience matches but assigns the
  visitor to the CONTROL/baseline variant (`variantIndex === 0`, `:206-209` → `resolveTo(entry)`),
  the returned `entry` equals the baseline YET `selectedOptimization` IS defined with
  `variantIndex: 0` (`:191-192`). ⇒ Do not read `selectedOptimization === undefined` as "seeing
  baseline content." source: `core-sdk` `OptimizedEntryResolver.ts:148-209`.
- `SelectedOptimization` fields: `experienceId`, `variantIndex`, `variants`, `sticky`. source:
  `api-schemas` `SelectedOptimization.ts:13-46`.

## Identifier ownership

| Identifier                              | Owner  | Notes                                                                                                                                                                           | source                                                                                                          |
| --------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `ctfl-opt-aid` (profile/anon-id cookie) | SDK    | Browser-readable; NOT `HttpOnly` (browser SDK reads it for hybrid takeover)                                                                                                     | `core-sdk` `constants.ts:38`                                                                                    |
| `ANONYMOUS_ID_COOKIE` constant          | SDK    | Exported from `/constants`; value === `'ctfl-opt-aid'`                                                                                                                          | `src/constants.ts:52` re-exports `core-sdk` `constants.ts:38`                                                   |
| `data-ctfl-*` tracking attributes       | SDK    | `-entry-id`, `-baseline-id`, `-optimization-id`, `-optimization-context-id`, `-variant-index`, `-sticky`, `-clickable`; entry-id must be the RESOLVED id                        | `presentation/OptimizedEntryTrackingAttributes.ts:70-73,83-97`; `entry-tracking/resolveTrackingPayload.ts:8-31` |
| app consent cookie/record               | reader | Reader names/writes/reads; SDK only reflects `consent()`                                                                                                                        | shared concept; guide                                                                                           |
| `<ctfl-optimized-entry entry-id>`       | SDK    | Managed-fetch INPUT: entry ID the SDK fetches via the configured `contentful.client`; NOT app lookup metadata. Manual alternative: assign the `baselineEntry` property instead. | `web-components/ContentfulOptimizedEntryElement.ts:77,101-111,253-262`                                          |
| browser env/config values               | reader | Bundler-agnostic; match the app's own browser-visible-var convention                                                                                                            | guide                                                                                                           |

## Events & tracking

- Event methods return `EventEmissionResult` `{ accepted, data? }`: `page(payload?)`,
  `identify({ userId, traits? })` (`userId` required), `track({ event, properties? })` (`event`
  required), `screen()`. source: `core-sdk` `CoreStatefulEventEmitter.ts:114,134,154,177`;
  `state/EventEmissionResult.ts:13-21`; `events/EventBuilder.ts:206,270`.
- `page()` (accepted) populates `states.selectedOptimizations`. source: `core-sdk`
  `applyOptimizationDataToSignals.ts`.
- `trackCurrentPage({ routeKey, buildPayload, initialPageEvent? })` — dedupes consecutive identical
  route keys; `initialPageEvent: 'skip'` for hybrid first-route dedupe; a bare `page()` always emits
  when consent permits. source: `src/ContentfulOptimization.ts:460-481`;
  `handlers/AcceptedCurrentStateTracker.ts:60-85`.
- Interaction tracking: SDK observes any DOM element carrying `data-ctfl-*`; auto view/click/hover
  on by default; opt out per-type via `autoTrackEntryInteraction`. Manual:
  `tracking.enableElement('views', el, { data, dwellTimeMs })` / `disableElement` / `clearElement`
  (manual data precedes attributes). Uses RESOLVED entry id. source:
  `entry-tracking/EntryInteractionRuntime.ts:199-219`;
  `resolveAutoTrackEntryInteractionOptions.ts:34-41,150-163`;
  `OptimizedEntryTrackingAttributes.ts:70-73`.
- Flags: `getFlag(name)` one-off; `states.flag(name)` reactive; flag-view emission gated on
  consent+profile and deduped. source: `core-sdk` `CoreStatefulEventEmitter.ts:87-92,371-404`.
- Analytics forwarding: `states.eventStream.current?.messageId` + `.subscribe`; dedupe by
  `messageId`; every event carries `messageId` + `type`. source: `api-schemas`
  `UniversalEventProperties.ts:94`; `experience/event/PageViewEvent.ts:39`.

## Consent & persistence

- Model: see [`../shared/concepts.md`](../shared/concepts.md#consent--persistence). Two axes.
  `consent(boolean)` sets both; `consent({ events, persistence })` sets independently. source:
  `core-sdk` `CoreStateful.ts:467-478`; `state/Consent.ts:9`.
- Default pre-consent allow-list = `['identify','page']`; other events blocked until consent.
  Overridden by `allowedEventTypes`. source: `src/constants.ts:13`;
  `consent/ConsentPolicy.ts:13-28`.
- `states.*` observables: `consent`, `persistenceConsent`, `profile`, `selectedOptimizations`,
  `eventStream`, `blockedEventStream`, `flag(name)`. Immediate-emit-on-subscribe; `.current` sync
  read; `.subscribe(...).unsubscribe()`. source: `core-sdk` `CoreStateful.ts:226-240`;
  `signals/Observable.ts:20-52,108-168`.
- `reset()` clears profile state, selected optimizations, route dedupe, `ctfl-opt-aid` cookie +
  LocalStore continuity (also stops entry-interaction tracking, clears changes/eventStream/
  blockedEventStream/experienceRequestState — non-exhaustive but nothing extra harms the reader).
  Does NOT touch consent/persistence signals or app/CMP records. source:
  `src/ContentfulOptimization.ts:443-449`; `core-sdk` `CoreStateful.ts:451-461`;
  `storage/LocalStore.ts:48-62`.
- `setLocale(nextLocale)` updates subsequent Experience/event locale only; does not refetch or clear
  caches. source: `core-sdk` `CoreStateful.ts:488-496`.

## Version / runtime quirks

- **Imperative + synchronously ready:** unlike the React SDK there is no "not ready on first render"
  window — `resolveOptimizedEntry()`, `getFlag()`, `states.*` work the moment the instance is
  constructed. BUT optimization state is empty until an accepted `page()`/`identify()` returns
  selections ⇒ resolve-before-emit yields baseline. Ordering: construct → emit → resolve. source:
  guide lifecycle section; `CoreStateful.ts:370-372`.
- SDK config is bundler-agnostic (no framework env-var convention). Store the instance in a
  module-level singleton.
- Web Components entrypoint is side-effect-free until `defineContentfulOptimizationElements()` runs.

## Failure & fallback behavior

- Baseline fallback on denied consent / no variant / unresolved links / all-locale payloads: see
  [`../shared/concepts.md`](../shared/concepts.md#baseline-fallback). Concrete fallback returns in
  `OptimizedEntryResolver.ts:148-177,218-235`.
- `consent(false)` blocks non-allowed events and clears SDK durable storage; does NOT drop the
  active in-memory profile (use `reset()`) or erase app/server/CMP records. source:
  `CoreStateful.ts:467-478`.
- Preview panel:
  `attachOptimizationPreviewPanel({ contentful? | entries? | optimization?, nonce? })` default
  export; `entries: { audiences, experiences }`; defaults to `window.contentfulOptimization` when
  `optimization` omitted. source:
  `preview-panel/src/attachOptimizationPreviewPanel.ts:242-261,425-432,138-144`;
  `preview-panel/src/lib/entries.ts:35-40`.
- Validation: `pnpm implementation:run -- web-sdk typecheck`; `pnpm test:e2e:web-sdk`. source:
  `implementations/web-sdk/package.json`; root `package.json`.
