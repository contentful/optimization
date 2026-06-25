---
title: Profile synchronization between client and server
---

# Profile synchronization between client and server

Use this document to understand how the Optimization SDK Suite keeps a visitor profile continuous
when a Node server and a browser client both participate in personalization and analytics. It
explains the difference between profile identity and profile data, how each SDK runtime stores that
state, and which application boundaries still belong to your implementation.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Runtime applicability](#runtime-applicability)
- [The synchronization model](#the-synchronization-model)
- [Constraints before synchronization](#constraints-before-synchronization)
- [Runtime responsibilities](#runtime-responsibilities)
- [Server-rendered profile data](#server-rendered-profile-data)
- [Profile identity and profile data](#profile-identity-and-profile-data)
- [Experience API response flow](#experience-api-response-flow)
- [Server-side mechanics](#server-side-mechanics)
  - [Profile upsert behavior](#profile-upsert-behavior)
  - [Request-scoped state](#request-scoped-state)
  - [Consent and persistence policy](#consent-and-persistence-policy)
- [Browser-side mechanics](#browser-side-mechanics)
  - [Initialization order](#initialization-order)
  - [Persistent browser state](#persistent-browser-state)
  - [Cookie and localStorage reconciliation](#cookie-and-localstorage-reconciliation)
  - [Stateful event delivery](#stateful-event-delivery)
- [Hybrid request lifecycle](#hybrid-request-lifecycle)
- [Known users and `identify()`](#known-users-and-identify)
- [Reset, revocation, and teardown](#reset-revocation-and-teardown)
- [Edge cases and failure modes](#edge-cases-and-failure-modes)
- [Implementation checklist](#implementation-checklist)
- [Related docs and reference implementations](#related-docs-and-reference-implementations)

<!-- mtoc-end -->
</details>

## Runtime applicability

Profile synchronization applies differently across SDK runtimes:

| Runtime                          | Applicability                                                                                                                                                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node SDK**                     | Stateless server runtime. It uses `forRequest()` to bind consent, locale, event context, and the current profile ID for one request. It does not store cookies or long-lived profile state.                                                              |
| **Web SDK**                      | Stateful browser runtime. It can use localStorage and the readable `ctfl-opt-aid` cookie for durable browser-server continuity when persistence consent resolves to `true`.                                                                              |
| **React Web SDK**                | React wrapper around the Web SDK. Providers and hooks share the same browser state, localStorage, cookie, and persistence-consent mechanics as the Web SDK.                                                                                              |
| **Next.js adapter**              | Hybrid runtime. Server helpers bind a request-scoped Node client, and the request handler can write or clear `ctfl-opt-aid` when persistence consent allows. Client components continue through the Web or React Web SDK state.                          |
| **React Native and mobile SDKs** | React Native uses AsyncStorage, and native mobile SDKs use platform storage instead of browser cookies. They can continue mobile profiles through the Experience API, but they do not provide a built-in `ctfl-opt-aid` cookie handoff to a Node server. |

## The synchronization model

Profile synchronization is event-driven. The SDKs do not run a continuous replication protocol
between server memory, browser memory, cookies, localStorage, and the Experience API.

Instead, synchronization uses three contracts:

- **A shared profile identifier** - The browser and server can share the `ctfl-opt-aid` cookie, also
  exported as `ANONYMOUS_ID_COOKIE`, so both runtimes send future Experience events to the same
  profile.
- **Experience API responses** - Calls such as `page()`, `identify()`, `screen()`, `track()`, and
  sticky `trackView()` return event results whose `data` contains `profile`,
  `selectedOptimizations`, and `changes` when the event is accepted and data is available.
- **Runtime persistence** - Stateful clients cache returned profile data for their own next startup
  when persistence consent allows. The Node SDK is stateless, so the application persists only the
  identifier or session state it needs between requests.

The Experience API remains the source of truth for profile aggregation. The shared cookie is a
continuity handle, not a full profile record.

```text
Server request reads ctfl-opt-aid
  -> Node SDK sends an Experience event with profileId
  -> Experience API returns profile, selectedOptimizations, and changes
  -> Server renders or persists the returned profile ID
  -> Browser initializes from cookie and localStorage when persistence consent is true
  -> Web SDK sends later Experience events with the same profile ID
  -> Experience API returns updated profile data
  -> Web SDK updates signals, plus localStorage and ctfl-opt-aid when persistence consent is true
```

## Constraints before synchronization

Profile synchronization depends on runtime policy and storage state before an SDK sends or resumes
profile-changing events:

- **Event consent and allowed event types** - Gated events need event consent unless
  `allowedEventTypes` permits that event when event consent is unset or false.
- **Persistence consent** - Durable profile-continuity keys, platform profile caches, and
  `ctfl-opt-aid` load or write only when persistence consent resolves to `true`. Configured defaults
  can seed in-memory state without enabling durable storage.
- **Storage availability** - Browser localStorage, readable cookies, AsyncStorage, UserDefaults, or
  SharedPreferences must be available for relaunch or client-server handoff continuity. Storage
  failure does not change the Experience API source of truth, but it can break local durability.
- **Preview and preflight mode** - Preview and preflight flows can evaluate profile state without
  storing normal profile mutations. Do not use them as the durability path for a profile ID you
  intend to continue.
- **Offline behavior** - Stateful clients can queue Experience events while offline, but no newer
  profile data is available until a request succeeds.
- **Configured defaults** - `defaults.profile`, `defaults.selectedOptimizations`,
  `defaults.changes`, and consent defaults bootstrap one runtime. They do not synchronize server and
  client state unless both runtimes also use the same profile ID or the same Experience API
  response.

For consent gates, see
[Consent management in the Optimization SDK Suite](./consent-management-in-the-optimization-sdk-suite.md).
For state shape and observable state mechanics, see
[Core state management](./core-state-management.md).

## Runtime responsibilities

The server, browser, and API each own different parts of the profile lifecycle:

| Runtime or layer              | Owns                                                                                          | Does not own                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Experience API**            | Profile creation, profile updates, audience evaluation, selected optimizations, and changes.  | Application consent policy, cookie settings, Contentful fetching, rendering, or response caching. |
| **Node SDK**                  | Stateless Experience and Insights calls using request-scoped profile IDs and request options. | Cookies, sessions, long-lived profile state, browser storage, or consent state.                   |
| **Web SDK and React Web SDK** | Browser state, consent state, localStorage caches, readable anonymous-ID cookie, and queues.  | Server sessions, server response caching, server-rendered hydration data, or Contentful fetching. |
| **Application**               | Consent policy, identity policy, cookie attributes, request context, and cache boundaries.    | The internal profile aggregation rules of the Experience API.                                     |

The React Web SDK uses the Web SDK under its providers and hooks, so profile synchronization follows
the same browser mechanics.

React Native is also stateful, but it persists with AsyncStorage instead of browser cookies. It can
continue a mobile profile through the Experience API, but this repository does not provide a
built-in cookie handoff between a React Native app and a Node server.

## Server-rendered profile data

Choose the server-rendering path before implementing a hybrid flow, because the choice determines
whether the browser needs only the shared profile ID or a bootstrapped `OptimizationData` snapshot.

The shared cookie is enough when the browser performs personalization after hydration. It is not
enough when the server already rendered profile-derived HTML and the browser must continue from the
same evaluated data before its first client-side Experience response.

| Path                              | Use when                                                                                                                         | Browser startup contract                                                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Server owns the first render**  | The server renders selected variants and profile-derived values, and the client can wait for fresh SDK data before re-resolving. | Persist `ctfl-opt-aid` when allowed, and prevent stale browser caches from driving visible personalized content before a later Experience response. |
| **Server bootstraps the browser** | The client must continue from the same evaluated data before its first browser Experience response.                              | Serialize the server's `profile`, `selectedOptimizations`, and `changes` into the page and pass them as Web SDK `defaults`.                         |
| **Browser owns personalization**  | The server can render baseline or loading output while the client resolves personalization after hydration.                      | Persist `ctfl-opt-aid` when allowed, then let the Web SDK call `page()` and resolve entries after selected optimizations are available.             |

Bootstrapping must use the same `OptimizationData` response that drove the server render:

```ts
const optimization = new ContentfulOptimization({
  clientId: 'your-client-id',
  environment: 'main',
  defaults: {
    profile: window.__OPTIMIZATION_DATA__.profile,
    selectedOptimizations: window.__OPTIMIZATION_DATA__.selectedOptimizations,
    changes: window.__OPTIMIZATION_DATA__.changes,
  },
})
```

If the browser re-resolves entries from stale localStorage while the server rendered from a newer
profile evaluation, the user can see a mismatched variant or profile-derived value. Use explicit
defaults, a fresh client-side `page()` response, or a render boundary that prevents stale cached
state from driving visible content.

Personalized HTML is not shared-cache safe unless the cache varies on all personalization inputs.
Raw Contentful entries are the safer cache boundary; resolve variants per request or per profile
selection.

## Profile identity and profile data

Profile identity and profile data are separate artifacts:

| Artifact                      | Shape                       | Purpose                                                                                         | Crosses the client-server boundary?                              |
| ----------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Profile ID**                | String                      | Selects which Experience API profile to create or update.                                       | Yes, commonly through `ctfl-opt-aid`.                            |
| **Partial profile payload**   | `{ id: string, ... }`       | Lets stateless calls associate an event with an existing profile.                               | Yes, but the ID is the important continuity field.               |
| **Full profile**              | `Profile`                   | Represents the evaluated profile returned by the Experience API. Includes traits and audiences. | Only if the application intentionally serializes it into output. |
| **Selected optimizations**    | `SelectedOptimizationArray` | Drives entry variant resolution for the evaluated profile.                                      | Only if server-rendered output or client hydration needs it.     |
| **Changes**                   | `ChangeArray`               | Drives Custom Flag values.                                                                      | Only if server-rendered output or client hydration needs it.     |
| **Event consent state**       | `boolean \| undefined`      | Controls whether gated events leave a stateful client or server request client.                 | Application-defined.                                             |
| **Persistence consent state** | `boolean \| undefined`      | Controls whether durable profile-continuity state can be loaded, written, or persisted.         | Application-defined.                                             |

The full `Profile` object can contain traits, audience memberships, location data, and session
statistics. Treat it as profile data, not as a general client-visible session token. In a hybrid
browser and server application, the durable shared value is normally the profile ID.

Merge tags resolve from the active `profile`. They do not read values from `changes`.

## Experience API response flow

All profile-changing Experience paths converge on `upsertProfile()`:

- When no `profileId` is provided, the API client creates a profile with `POST /profiles`.
- When a `profileId` is provided, the API client updates that profile with `POST /profiles/:id`.
- The response is normalized to `OptimizationData` with `profile`, `selectedOptimizations`, and
  `changes`, then surfaced as event result `data`.

The Experience API client also exposes `getProfile(id)` for reading the current evaluated profile
data without sending an event. That read path can refresh application state, but it does not replace
the event-driven synchronization flow used by `page()`, `identify()`, `screen()`, `track()`, and
sticky `trackView()`.

Stateful SDKs write that response to in-memory signals as a single batch. This means subscribers see
the profile, selected optimizations, and changes as one consistent snapshot after any state
interceptors complete.

Web and React Web read browser storage during initialization when persistence consent allows it.
After Core publishes in-memory state changes, Web signal effects mirror profile-continuity state to
localStorage and the anonymous-ID cookie on a best-effort basis. Browser subscribers do not wait for
a separate durable write before observing the new in-memory snapshot.

React Native reads AsyncStorage during async initialization when persistence consent allows it. Its
state persistence interceptor awaits the AsyncStorage write for an accepted Experience response
before Core publishes that response snapshot to observable state.

iOS and Android read platform storage before initializing the bridge when persistence consent allows
it. Their native bridge state handlers write the received snapshot through UserDefaults or
SharedPreferences when persistence consent is `true`, then update native observable state from that
snapshot.

Stateless Experience methods and `trackView()` return event results with `accepted` and optional
`data`. Non-sticky `trackView()` resolves with no `data`; `trackClick()`, `trackHover()`, and
`trackFlagView()` resolve without an event-result payload. Those Insights-only paths require a
request-bound profile because there is no ambient SDK state. The caller decides what to render, what
to persist, and what to pass into later SDK calls.

## Server-side mechanics

The Node SDK extends the stateless Core runtime. Create the Node SDK once per process or module, but
bind request-scoped inputs with `forRequest()` before calling event methods.

### Profile upsert behavior

In Node, Experience methods use the request-bound profile ID as the profile selector:

```ts
const appLocale = getAppLocale(req)
const profileId = req.cookies[ANONYMOUS_ID_COOKIE]
const requestOptimization = optimization.forRequest({
  consent: true,
  locale: appLocale,
  profile: profileId ? { id: profileId } : undefined,
})

const { accepted, data: optimizationData } = await requestOptimization.page({
  properties: { path: req.path },
})
```

For the difference between the application Contentful locale and the SDK Experience/event locale,
see
[Locale handling in the Optimization SDK Suite](./locale-handling-in-the-optimization-sdk-suite.md).

The Node SDK passes that ID to the Experience API as `profileId`. If the ID is absent, the API can
create a profile and return the new `profile.id`.

Insights-only stateless methods need a request-bound profile because there is no ambient state. For
example, non-sticky `trackView()`, `trackClick()`, `trackHover()`, and `trackFlagView()` require a
profile ID passed to `forRequest()`. Sticky `trackView()` first sends an Experience event and can
use the returned profile for the paired Insights event.

### Request-scoped state

The server must derive these values per request:

- The current profile ID, usually from `ANONYMOUS_ID_COOKIE` or an application session.
- The consent decision, usually from an application-owned consent cookie, session, or preference.
- The known user ID and traits, when an authenticated user exists.
- Page context, locale, user agent, and optional request options such as IP override.

The Node SDK does not keep those values between requests. This avoids cross-request state leakage in
long-lived Node processes and serverless runtimes.

### Consent and persistence policy

Consent policy belongs to the application layer on the server. A conservative server policy is:

- When consent is unknown or denied, do not persist `profile.id`.
- When consent is unknown or denied, do not emit follow-up tracking events.
- When event consent is granted, pass the stored profile ID into Experience calls.
- When persistence consent is granted, persist the returned `profile.id`.
- When consent is revoked, clear the stored profile ID and stop sending events until consent is
  granted again.

If the server uses `preflight: true`, the Experience API evaluates a profile state without storing
the mutation. Use that for preview or evaluation flows, not as the normal continuity path for a
profile ID you intend to persist.

## Browser-side mechanics

The Web SDK extends the stateful Core runtime. It owns browser-specific persistence and event
delivery around the same `profile`, `selectedOptimizations`, and `changes` signals described in
[Core state management](./core-state-management.md).

### Initialization order

On construction, the Web SDK first resolves event consent and persistence consent. It loads durable
profile-continuity state and anonymous-ID cookies only when persistence consent resolves to `true`.
The effective initialization order is:

1. Resolve consent and persistence consent from explicit `defaults`, persisted `LocalStore` values,
   and legacy accepted consent.
2. Merge explicit `defaults` supplied in the SDK configuration.
3. Load persisted profile, changes, and selected optimizations from `LocalStore` only when the
   resolved persistence consent is `true`. Explicit `defaults.profile`, `defaults.changes`, and
   `defaults.selectedOptimizations` can still seed in-memory state for that SDK instance.
4. Initialize Core state with the merged defaults.
5. Read the current and legacy anonymous-ID cookies only when the resolved persistence consent is
   `true`.
6. If a cookie ID exists and differs from `LocalStore.anonymousId`, clear active and cached
   profile-continuity state, then seed the anonymous ID from the cookie.

This order lets the browser resume from localStorage when durable profile-continuity persistence is
allowed and there is no server handoff, while still letting a server-set cookie take precedence when
a hybrid request identifies a different profile. If persistence consent is granted after
construction, the Web SDK runs the cookie adoption check at that time.

### Persistent browser state

The Web SDK exposes browser persistence through stable behavior, not localStorage key names.
Application code must treat exact keys as diagnostic-only implementation details and use SDK APIs,
configuration defaults, and `ANONYMOUS_ID_COOKIE` instead of reading or writing SDK localStorage
entries.

| Contract                       | Stored state                                                                                         | Integration boundary                                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Consent and debug storage**  | SDK event consent, SDK persistence consent, and debug logging preference.                            | Persistence consent does not disable this policy and diagnostic storage. Set it through `defaults`, `consent(...)`, and debug configuration. |
| **Profile-continuity storage** | Anonymous profile ID, returned `Profile`, selected optimizations, and Custom Flag changes.           | Loads and writes only when persistence consent resolves to `true`; clears durable continuity when persistence consent becomes `false`.       |
| **Shared cookie**              | `ctfl-opt-aid`, exported as `ANONYMOUS_ID_COOKIE`, stores the profile ID for browser-server handoff. | Built-in browser-server continuity channel when persistence consent is `true`; keep it browser-readable when the Web SDK must adopt it.      |
| **Legacy migration**           | Legacy anonymous-ID browser storage or cookie values.                                                | The SDK can migrate or remove legacy values during initialization. Do not depend on legacy names in application code.                        |

During diagnostics, you might see localStorage entries such as `__ctfl_opt_consent__`,
`__ctfl_opt_persistence_consent__`, `__ctfl_opt_debug__`, `__ctfl_opt_anonymous_id__`,
`__ctfl_opt_profile__`, `__ctfl_opt_selected-optimizations__`, and `__ctfl_opt_changes__`. These
names and serialized shapes are implementation details, not values application code reads or writes.

The `app-personalization-consent` name appears in examples only as an application-owned consent
cookie (`'granted'`, `'denied'`, or absent) that server and browser code can read. It is not an SDK
localStorage key.

Structured cache values are schema-validated when they are read. Malformed JSON or invalid shapes
are removed instead of being used as SDK state.

When persistence consent is `true`, the browser also persists the profile ID in the `ctfl-opt-aid`
cookie. This cookie is the only built-in browser-server synchronization channel.

Persistence consent controls whether the SDK writes and reloads profile-continuity state: anonymous
ID, profile, selected optimizations, changes, and the `ctfl-opt-aid` cookie. It does not disable SDK
storage of consent or debug settings.

Browser persistence is best-effort and follows Web SDK state. When persistence consent is `true`,
Web signal effects mirror profile, selected optimizations, changes, and anonymous ID to localStorage
and the readable cookie after Core state changes. Live reads come from memory; localStorage and the
cookie are startup and server-handoff durability channels.

### Cookie and localStorage reconciliation

The Web SDK keeps the cookie and localStorage anonymous ID aligned when persistence consent is
`true`:

- During initialization, a server-set `ctfl-opt-aid` cookie overrides a different local anonymous ID
  only when persistence consent resolves to `true`. The SDK calls `reset()` to clear active and
  cached profile-continuity state, then writes the cookie value to localStorage. If persistence
  consent is granted later, the same cookie adoption check runs then.
- When the profile signal changes after an Experience response, the SDK writes the full profile to
  localStorage and writes `profile.id` to both localStorage and the `ctfl-opt-aid` cookie.
- When the profile signal is cleared and an anonymous ID already exists, the SDK removes cached
  profile data but preserves the existing anonymous ID and `ctfl-opt-aid` cookie for future
  continuity. Use `reset()` or withdraw persistence consent when the application needs to end that
  continuity.
- When the profile signal is cleared and no anonymous ID exists, the SDK removes `ctfl-opt-aid`.
- If the legacy cookie `ntaid` exists, the SDK migrates its value and removes the legacy cookie.

For a hybrid Node and browser application, do not mark `ctfl-opt-aid` as `HttpOnly`. The Web SDK
must be able to read the cookie during initialization. Server or Next.js response code owns
response-cookie policy such as `SameSite`, `Secure`, `path`, `domain`, and readability. Configure
those attributes so the server route and browser code can access the same cookie. The Web SDK
browser writer supports its `cookie.domain` and `cookie.expires` options, always writes `Path=/`,
and does not expose `SameSite` or `Secure` controls for the browser-side write.

### Stateful event delivery

In the browser, Experience events select the profile with this priority:

1. `getAnonymousId()`, which by default returns `LocalStore.anonymousId` only when persistence
   consent is `true`.
2. The current in-memory `profile.id`.
3. No profile ID, which lets the Experience API create a profile.

Stateful browser methods accept a `profile` field in some payload types for API consistency, but the
synchronization channel is the stateful profile ID selected by the queue. In normal Web SDK usage,
seed or override browser identity through the shared cookie, localStorage, `defaults`, or
`getAnonymousId`, not by trying to pass a one-off `profile` object to every stateful call.

Insights events in the browser use the current profile signal. If no profile exists, the Insights
queue logs a warning and skips delivery.

## Hybrid request lifecycle

A Node and Web SDK application usually follows this lifecycle:

1. **First server request.** The request has no `ctfl-opt-aid` cookie. If the application's consent
   policy permits the server event, the server calls `page()` or `identify()` without a profile ID.
   The Experience API creates or evaluates a profile.
2. **Server response.** The server persists the returned `profile.id` in `ctfl-opt-aid` with
   `path: '/'` and a readable cookie policy for browser code when the application's persistence
   consent policy permits durable continuity.
3. **Browser initialization.** The Web SDK reads the cookie only when persistence consent resolves
   to `true`. If localStorage has a different anonymous ID or cached profile, the SDK clears the old
   profile-continuity state and adopts the cookie ID.
4. **Browser events.** Browser `page()`, router events, `identify()`, `track()`, and sticky
   `trackView()` calls update the same Experience API profile.
5. **Browser persistence.** Each Experience response updates browser signals. It updates
   localStorage and the `ctfl-opt-aid` cookie only when persistence consent is `true`.
6. **Later server request.** The server reads the same cookie and passes `{ profile: { id } }` into
   the next stateless SDK call.

The `node-sdk+web-sdk` reference implementation demonstrates this flow by setting
`ANONYMOUS_ID_COOKIE` on the server and verifying that the browser localStorage anonymous ID matches
the cookie.

## Known users and `identify()`

`identify()` adds a known `userId` and optional traits to the profile flow. It does not replace the
application's authentication session. The user ID comes from your application identity system, while
the profile ID continues to select the Experience API profile being updated.

On the server, pass the current anonymous profile ID into the request-bound client. If the page view
must be attributed to the known user, call `identify()` before `page()` on that same client:

```ts
const appLocale = getAppLocale(req)
const profile = anonymousId ? { id: anonymousId } : undefined
const requestOptimization = optimization.forRequest({
  consent: true,
  locale: appLocale,
  profile,
})

const identifyResult = await requestOptimization.identify({
  userId,
  traits: { authenticated: true },
})

const pageResult = await requestOptimization.page({
  properties: { path: req.path },
})
```

Then render and persist from the response that matches the user state you want for that response:
`pageResult` when the page response drives the render, or `identifyResult` when identification is
the last Experience response for the request. The request-bound client updates its internal profile
after each accepted Experience response, so the later `page()` call uses the profile returned by
`identify()`. If `identify()` and `page()` happen in different request-bound clients, bind the
returned `profile` into the later client with `forRequest({ profile })`, or persist `profile.id` and
bind `{ id }` on the later request. Do not pass a profile into `page()`.

If the request arrived anonymous but the response must include identified traits, render from the
`identify()` response or from a later `page()` response that used the identified request-bound
profile.

In the browser, call `identify()` after the Web SDK has adopted the shared anonymous ID. The
subsequent Experience response updates the same stateful profile and rewrites the browser caches.

## Reset, revocation, and teardown

Different lifecycle methods have different synchronization effects:

| Operation                                      | Effect                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `optimization.reset()` in Web                  | Clears profile, selected optimizations, changes, event streams, anonymous ID localStorage, and cookie.                                                       |
| `LocalStore.reset()` default                   | Clears profile-related browser caches and anonymous ID, but preserves consent and debug values.                                                              |
| `optimization.consent({ persistence: false })` | Clears SDK-managed durable profile-continuity storage and cookies, but leaves active in-memory profile state available until reset or teardown.              |
| `optimization.consent(false)`                  | Sets event and persistence consent to `false`, purges SDK queues, clears SDK-managed durable profile-continuity storage, and re-applies the allow-list gate. |
| `optimization.destroy()`                       | Flushes queues and releases runtime listeners. It does not clear persisted user state.                                                                       |
| Server consent revocation                      | Must clear the application-owned consent state and any persisted profile ID such as `ctfl-opt-aid`.                                                          |

`consent(false)` leaves the active in-memory SDK profile, selected optimizations, and changes
available until the application calls `reset()` or tears down the runtime. Future event calls emit
only when their event type remains permitted by `allowedEventTypes`. If consent revocation must also
remove active session personalization, call `reset()` in the browser and clear the server-side
cookie or session value in the same user flow.

## Edge cases and failure modes

The following cases are common sources of profile-sync bugs:

| Case                                     | What happens                                                                                                   | Mitigation                                                                                                                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ctfl-opt-aid` is `HttpOnly`             | The server can read it, but the Web SDK cannot adopt it.                                                       | Use a readable cookie for hybrid Node and Web SDK continuity.                                                                                                                                               |
| Cookie domain or path mismatch           | The browser and server use different profile IDs or no shared ID.                                              | Set `path: '/'` and a domain that covers the pages that initialize the Web SDK.                                                                                                                             |
| Cookie differs from localStorage         | The Web SDK clears cached profile-continuity data and adopts the cookie ID when persistence consent is `true`. | Treat this as expected when the server changes identity.                                                                                                                                                    |
| Cookie changes after SDK construction    | The running Web SDK does not continuously watch cookies.                                                       | Reinitialize intentionally after teardown or update identity through SDK event flows.                                                                                                                       |
| Multiple browser tabs                    | Tabs share storage, but in-memory signals are per runtime and do not auto-sync from storage events.            | Let each tab refresh state through Experience events or reload-sensitive application flows.                                                                                                                 |
| Offline browser Experience events        | Events queue locally and no new profile data is available until a successful flush.                            | Design UI so cached selections are acceptable while offline.                                                                                                                                                |
| Missing browser profile for Insights     | Insights delivery is skipped because stateful Insights events use the current profile signal.                  | Ensure an Experience call has returned a profile before relying on Insights-only tracking, or bootstrap a valid `defaults.profile` during SDK initialization when the server already evaluated the profile. |
| Server uses `preflight` for normal flows | The API evaluates without storing the mutation, which breaks durable profile continuity expectations.          | Reserve `preflight` for preview or non-persistent evaluation.                                                                                                                                               |
| Full profile serialized unnecessarily    | More profile data reaches the browser than the UI needs.                                                       | Share only the profile ID unless hydration needs profile data, changes, or selections.                                                                                                                      |

## Implementation checklist

Use this checklist when implementing a hybrid Node and browser profile flow:

- Persist `ANONYMOUS_ID_COOKIE` (`ctfl-opt-aid`) on the server after an Experience response returns
  `profile.id` and the application's persistence consent policy allows durable continuity.
- Use `path: '/'`, an appropriate domain, and a browser-readable cookie policy when the Web SDK must
  continue the same profile.
- Pass `{ profile: { id } }` into Node SDK Experience calls when a cookie or session ID exists.
- Call `identify()` before `page()` on the same Node request-bound client when the page view must be
  attributed to a known user.
- Let the Web SDK initialize once per browser runtime so it can reconcile cookie and localStorage
  state.
- Confirm persistence consent resolves to `true` before expecting the Web SDK to load persisted
  profile-continuity state or adopt `ctfl-opt-aid`.
- Render from the `OptimizationData` response that matches the current identity state.
- Bootstrap Web SDK `defaults` when server-rendered personalized output must match client-side
  resolution before the first browser Experience response.
- Clear both browser state and server persistence when consent revocation must end profile
  continuity.
- Cache raw Contentful delivery payloads, not profile-evaluated SDK responses or personalized HTML
  unless the cache key varies on the full personalization context.

## Related docs and reference implementations

- [Integrating the Optimization Node SDK in a Node app](../guides/integrating-the-node-sdk-in-a-node-app.md)
- [Integrating the Optimization Web SDK in a web app](../guides/integrating-the-web-sdk-in-a-web-app.md)
- [Integrating the React Web SDK in a React app](../guides/integrating-the-react-web-sdk-in-a-react-app.md)
- [Integrating the React Native SDK in a React Native app](../guides/integrating-the-react-native-sdk-in-a-react-native-app.md)
- [Integrating the Optimization SDK in a Next.js app with SSR](../guides/integrating-the-optimization-sdk-in-a-nextjs-app-ssr.md)
- [Integrating the Optimization SDK in a Next.js app with SSR and CSR](../guides/integrating-the-optimization-sdk-in-a-nextjs-app-ssr-csr.md)
- [Core state management](./core-state-management.md)
- [Consent management in the Optimization SDK Suite](./consent-management-in-the-optimization-sdk-suite.md)
- [Interaction tracking in Node and stateless environments](./interaction-tracking-in-node-and-stateless-environments.md)
- [Interaction tracking in Web SDKs](./interaction-tracking-in-web-sdks.md)
- [React Native SDK interaction tracking mechanics](./react-native-sdk-interaction-tracking-mechanics.md)
- [iOS SDK runtime and interaction mechanics](./ios-sdk-runtime-and-interaction-mechanics.md)
- [Android SDK runtime and interaction mechanics](./android-sdk-runtime-and-interaction-mechanics.md)
- [Node SDK and Web SDK reference implementation](../../implementations/node-sdk+web-sdk/README.md)
- [Next.js SSR reference implementation](../../implementations/nextjs-sdk_ssr/README.md)
- [Next.js hybrid reference implementation](../../implementations/nextjs-sdk_hybrid/README.md)
