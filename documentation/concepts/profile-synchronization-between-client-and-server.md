---
title: Profile synchronization between client and server
---

# Profile synchronization between client and server

Use this document to understand how the Optimization SDK Suite keeps a visitor profile continuous
when a Node server and a browser client both participate in personalization and analytics. It
explains the difference between profile identity and profile data, how each SDK runtime stores that
state, and which application boundaries still belong to your implementation.

For step-by-step setup, see
[Integrating the Optimization Node SDK in a Node app](../guides/integrating-the-node-sdk-in-a-node-app.md)
and
[Integrating the Optimization Web SDK in a web app](../guides/integrating-the-web-sdk-in-a-web-app.md).
For the in-memory state model used by stateful SDKs, see
[Core state management](./core-state-management.md).

<details>
  <summary>Table of Contents</summary>

- [The synchronization model](#the-synchronization-model)
- [Runtime responsibilities](#runtime-responsibilities)
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
- [Server-rendered profile data](#server-rendered-profile-data)
- [Reset, revocation, and teardown](#reset-revocation-and-teardown)
- [Edge cases and failure modes](#edge-cases-and-failure-modes)
- [Implementation checklist](#implementation-checklist)

</details>

## The synchronization model

Profile synchronization is event-driven. The SDKs do not run a continuous replication protocol
between server memory, browser memory, cookies, localStorage, and the Experience API.

Instead, synchronization uses three contracts:

- **A shared profile identifier** - The browser and server can share the `ctfl-opt-aid` cookie, also
  exported as `ANONYMOUS_ID_COOKIE`, so both runtimes send future Experience events to the same
  profile.
- **Experience API responses** - Calls such as `page()`, `identify()`, `screen()`, `track()`, and
  sticky `trackView()` return `OptimizationData` containing `profile`, `selectedOptimizations`, and
  `changes`.
- **Runtime persistence** - Stateful clients cache returned profile data for their own next startup.
  The Node SDK is stateless, so the application persists only the identifier or session state it
  needs between requests.

The Experience API remains the source of truth for profile aggregation. The shared cookie is a
continuity handle, not a full profile record.

```text
Server request reads ctfl-opt-aid
  -> Node SDK sends an Experience event with profileId
  -> Experience API returns profile, selectedOptimizations, and changes
  -> Server renders or persists the returned profile ID
  -> Browser initializes from cookie and localStorage
  -> Web SDK sends later Experience events with the same profile ID
  -> Experience API returns updated profile data
  -> Web SDK updates signals, localStorage, and ctfl-opt-aid
```

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

## Profile identity and profile data

Profile identity and profile data are separate artifacts:

| Artifact                    | Shape                       | Purpose                                                                                         | Crosses the client-server boundary?                              |
| --------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Profile ID**              | String                      | Selects which Experience API profile to create or update.                                       | Yes, commonly through `ctfl-opt-aid`.                            |
| **Partial profile payload** | `{ id: string, ... }`       | Lets stateless calls associate an event with an existing profile.                               | Yes, but the ID is the important continuity field.               |
| **Full profile**            | `Profile`                   | Represents the evaluated profile returned by the Experience API. Includes traits and audiences. | Only if the application intentionally serializes it into output. |
| **Selected optimizations**  | `SelectedOptimizationArray` | Drives entry variant resolution for the evaluated profile.                                      | Only if server-rendered output or client hydration needs it.     |
| **Changes**                 | `ChangeArray`               | Drives Custom Flag values and merge-tag-related profile data.                                   | Only if server-rendered output or client hydration needs it.     |
| **Consent state**           | `boolean \| undefined`      | Controls whether gated events leave a stateful client or server application layer.              | Application-defined.                                             |

The full `Profile` object can contain traits, audience memberships, location data, and session
statistics. Treat it as profile data, not as a general client-visible session token. In a hybrid
browser and server application, the durable shared value is normally the profile ID.

## Experience API response flow

All profile-changing Experience paths converge on `upsertProfile()`:

- When no `profileId` is provided, the API client creates a profile with `POST /profiles`.
- When a `profileId` is provided, the API client updates that profile with `POST /profiles/:id`.
- The response is normalized to `OptimizationData` with `profile`, `selectedOptimizations`, and
  `changes`.

The Experience API client also exposes `getProfile(id)` for reading the current evaluated profile
data without sending an event. That read path can refresh application state, but it does not replace
the event-driven synchronization flow used by `page()`, `identify()`, `screen()`, `track()`, and
sticky `trackView()`.

Stateful SDKs write that response to in-memory signals as a single batch. This means subscribers see
the profile, selected optimizations, and changes as one consistent snapshot. Browser and React
Native packages then persist that snapshot through platform-specific effects.

Stateless SDKs return the same `OptimizationData` to the caller and do not retain it. The caller
decides what to render, what to persist, and what to pass into later SDK calls.

## Server-side mechanics

The Node SDK extends the stateless Core runtime. Create the Node SDK once per process or module, but
pass request-scoped inputs into every SDK method call.

### Profile upsert behavior

In Node, Experience methods use `payload.profile?.id` as the profile selector:

```ts
const optimizationData = await optimization.page(
  {
    profile: { id: req.cookies[ANONYMOUS_ID_COOKIE] },
    properties: { path: req.path },
  },
  { locale: req.acceptsLanguages()[0] ?? 'en-US' },
)
```

The Node SDK passes that ID to the Experience API as `profileId`. If the ID is absent, the API can
create a profile and return the new `profile.id`.

Insights-only stateless methods need an explicit profile because there is no ambient state. For
example, non-sticky `trackView()`, `trackClick()`, `trackHover()`, and `trackFlagView()` require
`payload.profile.id`. Sticky `trackView()` first sends an Experience event and can use the returned
profile for the paired Insights event.

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
- When consent is granted, pass the stored profile ID into Experience calls and persist the returned
  `profile.id`.
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

On construction, the Web SDK resolves initial state in this order:

1. Read cached defaults from `LocalStore`, including consent, profile, changes, and selected
   optimizations.
2. Merge any explicit `defaults` supplied in the SDK configuration.
3. Initialize Core state with the merged defaults.
4. Read the current and legacy anonymous-ID cookies.
5. If a cookie ID exists and differs from `LocalStore.anonymousId`, clear profile-related state and
   seed the anonymous ID from the cookie.

This order lets the browser resume from localStorage when there is no server handoff, while still
letting a server-set cookie take precedence when a hybrid request identifies a different profile.

### Persistent browser state

The Web SDK persists these values in localStorage:

| Key                                   | Contents                                                                |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `__ctfl_opt_anonymous_id__`           | Anonymous profile ID used by future browser Experience calls.           |
| `__ctfl_opt_consent__`                | `'accepted'`, `'denied'`, or absent.                                    |
| `__ctfl_opt_profile__`                | Full `Profile` returned by the Experience API.                          |
| `__ctfl_opt_selected-optimizations__` | Selected optimization records used for browser-side variant resolution. |
| `__ctfl_opt_changes__`                | Change records used for Custom Flags.                                   |
| `__ctfl_opt_debug__`                  | Debug logging toggle.                                                   |

Structured cache values are schema-validated when they are read. Malformed JSON or invalid shapes
are removed instead of being used as SDK state.

The browser also persists the profile ID in the `ctfl-opt-aid` cookie. This cookie is the only
built-in browser-server synchronization channel.

### Cookie and localStorage reconciliation

The Web SDK keeps the cookie and localStorage anonymous ID aligned:

- During initialization, a server-set `ctfl-opt-aid` cookie overrides a different local anonymous
  ID. The SDK calls `reset()` to clear cached profile data, then writes the cookie value to
  localStorage.
- When the profile signal changes after an Experience response, the SDK writes the full profile to
  localStorage and writes `profile.id` to both localStorage and the `ctfl-opt-aid` cookie.
- When the profile signal is cleared, the SDK clears the anonymous ID from localStorage and removes
  the cookie.
- If the legacy cookie `ntaid` exists, the SDK migrates its value and removes the legacy cookie.

For a hybrid Node and browser application, do not mark `ctfl-opt-aid` as `HttpOnly`. The Web SDK
must be able to read the cookie during initialization. Configure the cookie `domain`, `path`, and
`SameSite` attributes so the server route and browser code can access the same cookie.

### Stateful event delivery

In the browser, Experience events select the profile with this priority:

1. `getAnonymousId()`, which defaults to `LocalStore.anonymousId`.
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

1. **First server request.** The request has no `ctfl-opt-aid` cookie. The server calls `page()` or
   `identify()` without a profile ID. The Experience API creates or evaluates a profile.
2. **Server response.** The server persists the returned `profile.id` in `ctfl-opt-aid` with
   `path: '/'` and a readable cookie policy for browser code.
3. **Browser initialization.** The Web SDK reads the cookie. If localStorage has a different
   anonymous ID or cached profile, the SDK clears the old profile-related state and adopts the
   cookie ID.
4. **Browser events.** Browser `page()`, router events, `identify()`, `track()`, and sticky
   `trackView()` calls update the same Experience API profile.
5. **Browser persistence.** Each Experience response updates browser signals, localStorage, and the
   `ctfl-opt-aid` cookie.
6. **Later server request.** The server reads the same cookie and passes `{ profile: { id } }` into
   the next stateless SDK call.

The `node-sdk+web-sdk` reference implementation demonstrates this flow by setting
`ANONYMOUS_ID_COOKIE` on the server and verifying that the browser localStorage anonymous ID matches
the cookie.

## Known users and `identify()`

`identify()` adds a known `userId` and optional traits to the profile flow. It does not replace the
application's authentication session. The user ID comes from your application identity system, while
the profile ID continues to select the Experience API profile being updated.

On the server, pass the current anonymous profile ID when identifying a known user:

```ts
const identifyResponse = await optimization.identify(
  {
    profile: { id: anonymousId },
    userId,
    traits: { authenticated: true },
  },
  requestOptions,
)
```

Then render and persist from the response that matches the user state you want for that response. If
the page view must be attributed to the known user, call `identify()` before `page()` and pass the
identified profile into the `page()` call. If the request arrived anonymous but the response must
include identified traits, render from the `identify()` response or from a later `page()` call that
uses the identified profile.

In the browser, call `identify()` after the Web SDK has adopted the shared anonymous ID. The
subsequent Experience response updates the same stateful profile and rewrites the browser caches.

## Server-rendered profile data

The shared cookie is enough when the browser performs personalization after hydration. It is not
enough when the server already rendered profile-derived HTML and the browser must continue from the
same evaluated data before its first client-side Experience response.

For server-rendered personalized output, choose one of these patterns:

- **Server owns the first render.** Render the selected variant and profile-derived values on the
  server, then avoid client-side re-resolution until the browser receives fresh optimization data.
- **Server bootstraps the browser.** Serialize the server's `profile`, `selectedOptimizations`, and
  `changes` into the page and pass them as Web SDK `defaults`.
- **Browser owns personalization.** Render a baseline or loading state on the server, then let the
  Web SDK call `page()` and resolve entries after selected optimizations are available.

Bootstrapping must use the same `OptimizationData` that drove the server render:

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

## Reset, revocation, and teardown

Different lifecycle methods have different synchronization effects:

| Operation                     | Effect                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| `optimization.reset()` in Web | Clears profile, selected optimizations, changes, event streams, anonymous ID localStorage, and cookie. |
| `LocalStore.reset()` default  | Clears profile-related browser caches and anonymous ID, but preserves consent and debug values.        |
| `optimization.consent(false)` | Blocks gated future events in stateful clients. It does not clear the profile ID by itself.            |
| `optimization.destroy()`      | Flushes queues and releases runtime listeners. It does not clear persisted user state.                 |
| Server consent revocation     | Must clear the application-owned consent state and any persisted profile ID such as `ctfl-opt-aid`.    |

If consent revocation must also remove profile continuity, call `reset()` in the browser and clear
the server-side cookie or session value in the same user flow.

## Edge cases and failure modes

The following cases are common sources of profile-sync bugs:

| Case                                     | What happens                                                                                          | Mitigation                                                                                                                                                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ctfl-opt-aid` is `HttpOnly`             | The server can read it, but the Web SDK cannot adopt it.                                              | Use a readable cookie for hybrid Node and Web SDK continuity.                                                                                                                                               |
| Cookie domain or path mismatch           | The browser and server use different profile IDs or no shared ID.                                     | Set `path: '/'` and a domain that covers the pages that initialize the Web SDK.                                                                                                                             |
| Cookie differs from localStorage         | The Web SDK clears cached profile data and adopts the cookie ID during construction.                  | Treat this as expected when the server changes identity.                                                                                                                                                    |
| Cookie changes after SDK construction    | The running Web SDK does not continuously watch cookies.                                              | Reinitialize intentionally after teardown or update identity through SDK event flows.                                                                                                                       |
| Multiple browser tabs                    | Tabs share storage, but in-memory signals are per runtime and do not auto-sync from storage events.   | Let each tab refresh state through Experience events or reload-sensitive application flows.                                                                                                                 |
| Offline browser Experience events        | Events queue locally and no new profile data is available until a successful flush.                   | Design UI so cached selections are acceptable while offline.                                                                                                                                                |
| Missing browser profile for Insights     | Insights delivery is skipped because stateful Insights events use the current profile signal.         | Ensure an Experience call has returned a profile before relying on Insights-only tracking, or bootstrap a valid `defaults.profile` during SDK initialization when the server already evaluated the profile. |
| Server uses `preflight` for normal flows | The API evaluates without storing the mutation, which breaks durable profile continuity expectations. | Reserve `preflight` for preview or non-persistent evaluation.                                                                                                                                               |
| Full profile serialized unnecessarily    | More profile data reaches the browser than the UI needs.                                              | Share only the profile ID unless hydration needs profile data, changes, or selections.                                                                                                                      |

## Implementation checklist

Use this checklist when implementing a hybrid Node and browser profile flow:

- Persist `ANONYMOUS_ID_COOKIE` (`ctfl-opt-aid`) on the server after a consent-allowed Experience
  response returns `profile.id`.
- Use `path: '/'`, an appropriate domain, and a browser-readable cookie policy when the Web SDK must
  continue the same profile.
- Pass `{ profile: { id } }` into Node SDK Experience calls when a cookie or session ID exists.
- Let the Web SDK initialize once per browser runtime so it can reconcile cookie and localStorage
  state.
- Render from the `OptimizationData` response that matches the current identity state.
- Bootstrap Web SDK `defaults` when server-rendered personalized output must match client-side
  resolution before the first browser Experience response.
- Clear both browser state and server persistence when consent revocation must end profile
  continuity.
- Cache raw Contentful delivery payloads, not profile-evaluated SDK responses or personalized HTML
  unless the cache key varies on the full personalization context.
