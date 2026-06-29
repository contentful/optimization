---
title: Consent management in the Optimization SDK Suite
---

# Consent management in the Optimization SDK Suite

Use this document to design consent flows that use the Optimization SDK Suite without treating the
SDK as the policy engine. It explains how the SDK stores and applies consent, how consumers can map
consent management platform (CMP) decisions into SDK configuration, and how common regulatory
expectations affect integration choices.

This document applies to the Web, React Web, Next.js adapter, Node, React Native, iOS, and Android
SDKs. Next.js server and ESR paths follow Node consent mechanics; Next.js client components follow
React Web consent mechanics. The Next.js context handler is request-context forwarding only; it is
not a consent path. This document uses these terms:

- **Event consent** - The SDK runtime value that gates Optimization event emission.
- **Persistence consent** - The SDK runtime value that gates durable profile-continuity storage.
- **Allow-list** - The configured `allowedEventTypes` that can emit while event consent is unset or
  false.
- **Blocked event** - An SDK event call that the consent gate rejected because event consent was
  unset or false and the call did not match the configured `allowedEventTypes`.

This document is engineering guidance, not legal advice. Your application owns legal interpretation,
jurisdiction detection, CMP behavior, consent records, privacy notices, and downstream destination
policy. The SDK provides controls that can support a compliant implementation, but those controls do
not make an application compliant by themselves.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [The consent responsibility model](#the-consent-responsibility-model)
- [Runtime support summary](#runtime-support-summary)
- [Choose a pre-consent posture](#choose-a-pre-consent-posture)
- [Consent constraints before implementation](#consent-constraints-before-implementation)
- [SDK consent behavior](#sdk-consent-behavior)
  - [Stateful SDKs](#stateful-sdks)
  - [Node and stateless runtimes](#node-and-stateless-runtimes)
  - [Event allow-lists and blocked events](#event-allow-lists-and-blocked-events)
  - [Revocation and profile cleanup](#revocation-and-profile-cleanup)
  - [Blocked-event diagnostics by runtime](#blocked-event-diagnostics-by-runtime)
- [Configure consent flows](#configure-consent-flows)
  - [Map CMP choices to SDK state](#map-cmp-choices-to-sdk-state)
  - [Keep server and browser policy aligned](#keep-server-and-browser-policy-aligned)
  - [Align third-party destinations](#align-third-party-destinations)
- [Regulatory expectations and SDK configuration](#regulatory-expectations-and-sdk-configuration)
  - [Shared implementation principles](#shared-implementation-principles)
  - [Regional considerations](#regional-considerations)
- [Engineering checklist](#engineering-checklist)
- [Related documentation](#related-documentation)

<!-- mtoc-end -->
</details>

## The consent responsibility model

Consent is shared work between the application, the SDK, and any destinations that receive mirrored
events.

| Layer                          | Owns                                                                                           | Does not own                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Application or CMP**         | Notice text, choices, jurisdiction logic, consent records, purpose categories, and withdrawal. | SDK event gates, Experience API profile evaluation, or Insights API delivery.                 |
| **Optimization SDK Suite**     | Runtime consent state, allowed-event checks, blocked-event diagnostics, and local persistence. | Legal basis selection, consent UI, proof of consent, data subject requests, or vendor policy. |
| **Node or server application** | Request-scoped consent checks, cookies, sessions, profile persistence, and response caching.   | Stateful SDK consent storage or browser-side CMP behavior.                                    |
| **Third-party destinations**   | Their own consent mode, opt-out handling, deletion flows, and contractual processing controls. | Optimization SDK consent state or Contentful profile evaluation.                              |

The SDK's consent value is a runtime control, not a consent record. Store the user-facing consent
receipt in the CMP, user-preference service, consent cookie, or account system your organization
uses for audit and withdrawal.

The SDK exposes event consent as the cross-runtime event-emission control and supports an optional
separate persistence consent state for durable profile continuity. If your CMP uses separate
categories for personalization, analytics, advertising, and third-party sharing, map those
categories before calling `consent(true)` or `consent({ events, persistence })`. If one SDK event
type or downstream destination is not permitted, keep the SDK denied for that flow and gate the
affected method calls or forwarding code in the application layer.

## Runtime support summary

Use the runtime surface that matches where the consent decision is applied:

| Runtime          | Consent API surface                                                                                                                             | Storage and persistence                                                                                                  | Default allow-list                                                                                      | Blocked-event diagnostics                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Web**          | `defaults.consent`, `defaults.persistenceConsent`, and `optimization.consent(true \| false \| { events, persistence })`                         | Browser `localStorage`; readable `ctfl-opt-aid` cookie for profile continuity when persistence consent permits it.       | `identify` and `page` can emit before event consent unless `allowedEventTypes` changes.                 | `onEventBlocked` and `optimization.states.blockedEventStream`                         |
| **React Web**    | `OptimizationRoot` `defaults` and `useOptimizationActions().consent(...)`; injected SDKs can call `sdk.consent(...)`                            | Same Web SDK storage: browser `localStorage` and the readable `ctfl-opt-aid` cookie when persistence consent permits it. | `identify` and `page` can emit before event consent unless `allowedEventTypes` changes.                 | `onEventBlocked` and `states.blockedEventStream`                                      |
| **Next.js**      | Server `getNextjsServerOptimizationData(..., { consent })`, ESR `getNextjsEsrOptimizationData(..., { consent })`, and client `OptimizationRoot` | Server and ESR paths use application-owned cookies and request state; client paths use React Web storage.                | Server, ESR, and client paths follow `identify` and `page` defaults unless `allowedEventTypes` changes. | Server-side `onEventBlocked`; client `onEventBlocked` and `states.blockedEventStream` |
| **Node**         | Request-scoped `optimization.forRequest({ consent })`                                                                                           | No SDK storage; applications own cookies, sessions, consent records, and profile ID persistence.                         | `identify` and `page` can emit before request event consent unless `allowedEventTypes` changes.         | `onEventBlocked` only                                                                 |
| **React Native** | `OptimizationRoot` `defaults` and `useOptimization().consent(...)`                                                                              | AsyncStorage persists consent and, when persistence consent permits it, profile-continuity state across launches.        | `identify` and `screen` can emit before event consent unless `allowedEventTypes` changes.               | `onEventBlocked` and `states.blockedEventStream`                                      |
| **iOS**          | `StorageDefaults(consent:)`, `client.consent(_:)`, and `client.consent(events:persistence:)`                                                    | UserDefaults persists consent and, when persistence consent permits it, profile-continuity state across launches.        | `identify` and `screen` can emit before event consent unless `allowedEventTypes` changes.               | `OptimizationConfig.onEventBlocked` and `client.blockedEventStream`                   |
| **Android**      | `StorageDefaults(consent = true)`, `client.consent(true \| false)`, and `client.consent(events = true, persistence = false)`                    | SharedPreferences persists consent and, when persistence consent permits it, profile-continuity state across launches.   | `identify` and `screen` can emit before event consent unless `allowedEventTypes` changes.               | `OptimizationConfig.onEventBlocked` and `client.blockedEventStream`                   |

## Choose a pre-consent posture

There are three common implementation postures. Choose the runtime column that matches where the SDK
is initialized; server paths also bind consent on each request:

| Posture                         | Web, React Web, and React Native                                                                                       | iOS                                                                                                                   | Android                                                                                                                 | Node and Next.js server paths                                                                                                                                                | Use when                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Strict opt-in**               | Initialize with `allowedEventTypes: []`; leave `defaults.consent` unset and persistence consent unset or false.        | Pass `allowedEventTypes: []`; do not pass `StorageDefaults(consent: true)`; keep persistence consent unset or false.  | Pass `allowedEventTypes = emptyList()`; do not pass `StorageDefaults(consent = true)`; keep persistence consent false.  | Configure the singleton with `allowedEventTypes: []`; bind `forRequest({ consent: { events: false, persistence: false } })` or the equivalent Next server/ESR helper option. | Policy does not permit non-essential event emission or durable profile-continuity storage before opt-in.                         |
| **Limited pre-consent context** | Leave consent unset; use the runtime default or custom `allowedEventTypes`; keep persistence consent unset or false.   | Don't pass `StorageDefaults(consent: true)`; pass a narrow `allowedEventTypes` list; keep persistence consent false.  | Don't pass `StorageDefaults(consent = true)`; pass a narrow `allowedEventTypes` list; keep persistence consent false.   | Configure a narrow singleton `allowedEventTypes`; derive per-request `forRequest({ consent })` or Next server/ESR helper consent from application request state.             | Legal review permits specific first-party context events before broader tracking consent.                                        |
| **Default-on accepted context** | Seed `defaults.consent: true`; set `defaults.persistenceConsent: false` only when profile continuity must be deferred. | Seed `StorageDefaults(consent: true)`; set `persistenceConsent: false` only when profile continuity must be deferred. | Seed `StorageDefaults(consent = true)`; set `persistenceConsent = false` only when profile continuity must be deferred. | Bind accepted request consent with `forRequest({ consent: { events: true, persistence: true } })` or the equivalent Next server/ESR helper option.                           | Application policy permits SDK event emission and profile continuity at startup, with or without a separate end-user consent UI. |

For browser applications, storage policy can matter as much as event policy. `allowedEventTypes: []`
prevents event emission, while persistence consent gates durable profile-continuity storage. It is
not a blanket block on all browser storage access by an initialized SDK. If legal review forbids any
SDK browser storage access before opt-in, defer Web, React Web, or Next.js client initialization
until consent is known and your policy permits SDK browser storage. Also avoid server-set anonymous
cookies until the CMP allows them. The SDK still does not own browser storage policy, server-set
cookies, or CMP records.

## Consent constraints before implementation

Account for these constraints before wiring lifecycle details:

- **Consent source of truth** - Keep the CMP, consent cookie, account preference, or user-preference
  service as the record. SDK consent is a runtime input derived from that record.
- **`allowedEventTypes`** - The allow-list controls event emission before event consent is true. It
  does not grant storage permission, create a consent record, configure third-party destinations, or
  decide whether server cookies can be written.
- **Persistence consent** - Durable profile continuity is separate from event emission. Boolean
  consent calls set both values by default; object-form consent can allow events while keeping
  profile continuity session-only.
- **Storage availability** - Platform storage is a durability layer, not the live source of truth.
  If browser storage, AsyncStorage, UserDefaults, or SharedPreferences is unavailable or blocked,
  design the application to continue from runtime state.
- **Offline queue purge** - Withdrawing event consent with `consent(false)` purges queued SDK
  Experience and Insights events. Blocked events are not replayed when consent later becomes true.
- **Preview mode** - Preview panels and preview overrides change live-update and preview behavior;
  they do not replace application consent policy or turn denied event gates into accepted consent.

## SDK consent behavior

### Stateful SDKs

Stateful SDKs include the Web SDK, React Web SDK, React Native SDK, iOS SDK, and Android SDK.
Next.js client components use the React Web stateful runtime. They hold event consent as one of
three values:

| Consent value | Meaning                                                                       |
| ------------- | ----------------------------------------------------------------------------- |
| `undefined`   | No SDK consent decision has been set in this runtime.                         |
| `true`        | The SDK can emit all configured event types.                                  |
| `false`       | The SDK blocks event types that are not present in the configured allow-list. |

Stateful SDKs persist event consent in their platform storage so later visits or app launches can
restore the decision. They also persist a separate profile-continuity persistence consent value when
one is set. Browser SDKs use localStorage and can also use the readable `ctfl-opt-aid` cookie for
profile continuity. React Native persists with AsyncStorage. The iOS SDK persists with UserDefaults.
The Android SDK persists with SharedPreferences.

Stateful SDKs initialize early enough to support first-render personalization, but they restore
storage in two steps. On startup, the SDK reads consent and preference state first. It reads durable
profile continuity, such as profile IDs, cached profile data, selected optimizations, and mobile
profile-continuity state, only after persistence consent resolves to `true`. If persistence consent
resolves to `false`, the SDK clears SDK-managed durable profile-continuity storage. If persistence
consent is `undefined`, the SDK does not restore durable profile continuity.

Use `defaults.consent: true` in Web, React Web, and React Native, `StorageDefaults(consent: true)`
in iOS, or `StorageDefaults(consent = true)` in Android when the application policy permits the SDK
to start in an accepted state, including integrations that do not render an end-user consent UI.
This starts all gated SDK events immediately and permits durable profile continuity. Existing
boolean consent calls map to both event and persistence consent. Use
`consent({ events: true, persistence: false })` when events are allowed but durable profile
continuity must remain session-only. For production consent prompts, leave consent unset and call
`consent(true)`, `consent(false)`, or object-form consent from the CMP or banner callback.

### Node and stateless runtimes

The Node SDK does not store consent. Next.js server and ESR paths use this same request-scoped model
through adapter helpers. When the application policy permits Optimization by default, bind each
request with accepted event and persistence consent:

Node / TypeScript:

```ts
const requestOptimization = optimization.forRequest({
  consent: { events: true, persistence: true },
  eventContext: { locale: eventLocale },
  profile,
})
```

When consent depends on request-specific state, server applications must read it from a
request-scoped source, such as a consent cookie, session, account preference, or CMP token, before
binding a request client or persisting profile identifiers.

Node / TypeScript:

```ts
const canEmitOptimizationEvent = request.cookies['app-personalization-consent'] === 'granted'

const requestOptimization = optimization.forRequest({
  consent: {
    events: canEmitOptimizationEvent,
    persistence: canEmitOptimizationEvent,
  },
  eventContext: { locale: eventLocale },
  profile,
})

const { accepted, data } = await requestOptimization.page()
```

Node SDK event calls fail closed except for the configured `allowedEventTypes`. The Node SDK default
allows `identify` and `page` before event consent, and those events are sent with
`context.gdpr.isConsentGiven: false`. Pass `allowedEventTypes: []` for strict opt-in, or configure a
narrow allow-list when legal review approves a specific pre-consent server event. Do not persist the
returned profile ID unless request persistence consent is true:

Node / TypeScript:

```ts
const optimization = new ContentfulOptimization({
  allowedEventTypes: ['page'],
  clientId: 'your-client-id',
})

const requestOptimization = optimization.forRequest({
  consent: { events: false, persistence: false },
  eventContext: { locale: eventLocale },
  profile,
})

const { accepted, data } = await requestOptimization.page()

if (accepted && requestOptimization.canPersistProfile && data?.profile.id) {
  persistProfileId(data.profile.id)
}
```

A conservative server policy is:

- Do not call profile-producing SDK methods when consent is unknown or denied unless legal review
  has approved that pre-consent behavior.
- Do not persist `profile.id` or `ctfl-opt-aid` when consent is unknown or denied.
- Clear application-owned profile identifiers when consent revocation must end profile continuity.
- Render baseline content when the consent policy does not permit personalization.

### Event allow-lists and blocked events

`allowedEventTypes` controls which event types can emit while consent is `undefined` or `false`.
Default allow-lists differ by runtime. For example, browser guides describe `identify` and `page` as
the Web and React Web pre-consent defaults, while mobile guides describe `identify` and `screen` as
mobile defaults.

Use these `allowedEventTypes` selectors exactly:

| Selector          | Allows                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `identify`        | `identify()` Experience events and profile trait updates                                               |
| `page`            | `page()` Experience events and current-page tracking                                                   |
| `screen`          | `screen()` Experience events and current-screen tracking                                               |
| `track`           | Custom `track()` Experience events                                                                     |
| `component`       | Entry view events from `trackView()` and automatic entry view tracking; also admits flag-view payloads |
| `component_click` | Entry click or tap events from `trackClick()` and automatic click or tap tracking                      |
| `component_hover` | Entry hover events from `trackHover()` and automatic hover tracking                                    |
| `flag`            | Custom Flag view tracking without allowing all entry view events                                       |

Use `component_click` and `component_hover`, not `click`, `tap`, or `hover`. Use `component`, not
`view`, for entry view events. Custom Flag view payloads still emit as `component` events, but
`flag` is the narrower selector when only flag exposures are permitted.

Use the allow-list as a policy mapping tool:

- Set `allowedEventTypes: []` when no Optimization event can emit before consent.
- Remove `identify` from the allow-list when profile mutation is not allowed before consent.
- Keep only the event types that your legal and privacy review permits for the purpose and region.

The allow-list only controls event emission. It does not control when a CMP renders, when browser
storage is read, when a server writes cookies, whether a user has received a valid notice, or
whether a third-party destination can receive mirrored events.

Allow-listed events can emit before event consent is granted, but their SDK-built payloads mark
`context.gdpr.isConsentGiven` as `false` until event consent is explicitly `true`.

When the consent guard blocks an event, the SDK writes blocked-event metadata to the runtime's
diagnostic surface. Blocked events are dropped at the SDK boundary and are not replayed after
`consent(true)`. Do not store or resend suppressed interaction events such as clicks, taps, hovers,
or custom interactions.

In this document, blocked event means consent-blocked event. Missing request-bound profiles, storage
read or write failures, offline retries, duplicate current-state guards, disabled automatic
trackers, application logic that skips SDK calls, and other SDK or application guards use other
diagnostics, such as logs, return values, queue callbacks, thrown errors, or application-owned
observability. Those conditions might not appear in `blockedEventStream`.

SDK-owned current-state surfaces can still emit a fresh event after consent when the underlying
condition is still current and the event has not already been accepted. Automatic page or screen
trackers can emit the active page or screen after tracking becomes allowed, and active flag
subscriptions can emit a flag-view event for the current flag value. Those emissions represent the
current application state after consent, not replay of the previously blocked event.

### Revocation and profile cleanup

Calling `consent(false)` blocks future non-allowed events in stateful clients and purges queued SDK
Experience and Insights events. It also clears SDK-managed durable profile-continuity storage. It
leaves the current in-memory profile, selected optimizations, and changes untouched so the
application can decide whether to reset the active session. It does not erase the consent record in
your CMP, clear server cookies, delete Contentful-side profile data, or remove application-owned
profile continuity.

When withdrawal must stop both future events and profile continuity:

- Call `consent(false)` so the SDK blocks future gated events.
- Call the runtime reset method when the active session must be cleared: `reset()` in Web, React
  Web, and React Native, or `client.reset()` in iOS and Android.
- Clear application-owned cookies, sessions, and server-side profile IDs, including any
  server-managed `ctfl-opt-aid` value.
- Stop Node SDK calls until request-scoped consent permits them again.
- Apply the same withdrawal state to third-party analytics, advertising, tag management, and data
  warehouse destinations.

If withdrawal also requires deletion or suppression in external systems, implement those flows
outside the SDK with the systems that store the data.

### Blocked-event diagnostics by runtime

Use the diagnostic surface that the runtime exposes for consent-blocked events:

| Runtime                              | Diagnostic surface                                                                                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Web, React Web, and React Native** | Configure `onEventBlocked` for a startup logger, or subscribe to `states.blockedEventStream` when a component, debug panel, or test needs dynamic observation. |
| **Next.js**                          | Configure server-side `onEventBlocked` on the underlying server SDK; use React Web diagnostics in client components.                                           |
| **Node**                             | Configure `onEventBlocked` on the process-level SDK. Stateless request clients do not expose a `states.blockedEventStream` surface.                            |
| **iOS**                              | Configure `OptimizationConfig(..., onEventBlocked: { ... })`, or subscribe to `client.blockedEventStream` from Swift, UIKit, or test code.                     |
| **Android**                          | Configure `OptimizationConfig(onEventBlocked = { ... })`, or subscribe to `client.blockedEventStream` from Compose, XML Views, or test code.                   |

## Configure consent flows

### Map CMP choices to SDK state

Treat the CMP or application preference service as the source of truth. The SDK receives the result:

Stateful JavaScript SDK / TypeScript:

```ts
cmp.onChange((choice) => {
  const optimizationAllowed = choice.purposes.personalization && choice.purposes.analytics

  optimization.consent(optimizationAllowed)
})
```

When event emission and durable profile continuity are separate CMP choices, pass the fields your
CMP decision owns. Omitted fields retain their previous value:

Stateful JavaScript SDK / TypeScript:

```ts
cmp.onChange((choice) => {
  optimization.consent({
    events: choice.purposes.personalization && choice.purposes.analytics,
    persistence: choice.purposes.profileContinuity,
  })
})
```

If your CMP has separate purposes, avoid mapping one accepted purpose to `consent(true)` when other
SDK event types or mirrored destinations remain disallowed. In that case, keep the SDK denied and
gate the allowed calls explicitly, or use `allowedEventTypes` to permit only the approved event
types before full consent exists.

### Keep server and browser policy aligned

Hybrid applications, including Next.js applications, often run the Node SDK or server adapter on the
server and the Web or React Web SDK in the browser. Use the same consent decision on both sides:

- The server reads consent before calling `page()`, `identify()`, or follow-up tracking methods and
  calls the Node SDK only when the application policy allows the server event.
- The browser calls `consent(true)` or `consent(false)` from the same CMP state after hydration.
- Both runtimes clear profile continuity when withdrawal requires it.
- The server does not set `ctfl-opt-aid` when the browser is not allowed to use profile continuity.

If the server personalizes HTML while the browser denies SDK consent after hydration, the user can
see personalized content without follow-up event collection. Decide whether that is permitted. If
not, render baseline content until the consent state is known.

### Align third-party destinations

The SDK consent gate controls Optimization SDK event emission. It does not automatically configure
Google Consent Mode, tag managers, advertising platforms, analytics warehouses, or customer data
platforms.

When forwarding SDK context or event streams:

- Use the same CMP state before forwarding events to each destination.
- Apply opt-out, global privacy signal, and sensitive-data restrictions before mirroring SDK events.
- Avoid sending Optimization profile IDs as known-user IDs to third-party analytics tools.
- Deduplicate events by message or event identity after consent changes so a fresh post-consent
  event does not create duplicate downstream reporting.

## Regulatory expectations and SDK configuration

Use this section as an implementation lens. The linked sources describe regulatory expectations;
your legal review decides which expectations apply to each property, region, purpose, and data flow.

### Shared implementation principles

Use the same SDK controls after your legal and privacy review maps the applicable rules:

- Explain Optimization purposes before enabling SDK event emission when notice or consent is
  required.
- Keep the CMP, account system, or preference service as the consent record; SDK consent is only a
  runtime value.
- Map event emission, durable profile continuity, server profile IDs, and third-party destination
  routing as separate choices when your policy separates those purposes.
- Leave SDK consent unset or use `allowedEventTypes: []` when pre-consent events are not permitted.
  Defer Web, React Web, or Next.js client initialization when any SDK browser storage access is not
  permitted before opt-in.
- Use `defaults.consent: true` only when application policy permits accepted SDK startup, such as a
  valid existing consent record or a default-on policy.
- Call `consent(false)` on refusal or withdrawal to block gated events, purge SDK queues, and clear
  SDK-managed durable profile continuity. Call the runtime reset method plus application cookie
  cleanup when withdrawal must also clear the active in-memory profile.
- Gate sensitive traits, audience attributes, custom event properties, and mirrored downstream
  events before sending them.

### Regional considerations

| Region or framework                     | Source links                                                                 | SDK configuration lens                                                                                                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EU GDPR, ePrivacy, and UK PECR          | [EDPB GDPR][edpb-gdpr], [EDPB ePrivacy][edpb-eprivacy], [ICO PECR][ico-pecr] | Treat affirmative consent, withdrawal, and device-storage access as the primary configuration drivers. Use strict opt-in when pre-consent event or storage access is not permitted. |
| California CCPA and CPRA                | [California CCPA and CPRA][california-ccpa]                                  | Treat opt-out of sale or sharing, global privacy signals, and sensitive-data limits as application-owned routing and payload policy before SDK calls or forwarding.                 |
| Canada PIPEDA and Australia Privacy Act | [OPC PIPEDA][opc-pipeda], [OAIC Privacy Act][oaic-privacy]                   | Use meaningful purpose disclosure, keep a consent record outside the SDK, and apply withdrawal across SDK state, server persistence, local profile continuity, and destinations.    |
| Brazil LGPD                             | [ANPD cookie guidance][anpd-lgpd]                                            | Present purpose categories for personalization, analytics, and sharing, then enable only the SDK event and persistence choices those purposes cover.                                |
| India DPDP Act                          | [Digital Personal Data Protection Act, 2023][india-dpdp]                     | Sync notice, clear affirmative choice, purpose limits, and withdrawal state into browser, server, and mobile SDK runtimes.                                                          |

[edpb-gdpr]:
  https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052020-consent-under-regulation-2016679_en
[edpb-eprivacy]:
  https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-22023-technical-scope-art-53-eprivacy-directive_en
[ico-pecr]:
  https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/
[california-ccpa]: https://oag.ca.gov/privacy/ccpa
[opc-pipeda]:
  https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/principles/p_consent/
[oaic-privacy]:
  https://www.oaic.gov.au/privacy/your-privacy-rights/your-personal-information/consent-to-the-handling-of-personal-information
[anpd-lgpd]:
  https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais
[india-dpdp]:
  https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf

## Engineering checklist

Before releasing a consent-aware Optimization SDK integration, verify these implementation points:

- Document each SDK event purpose and downstream destination in your privacy design.
- Decide whether pre-consent SDK initialization, localStorage, cookies, or profile IDs are allowed.
- Configure `allowedEventTypes` to match the approved pre-consent event set.
- Seed `defaults.consent: true` only when application policy permits accepted SDK startup, such as a
  default-on policy or an existing accepted consent record.
- Connect the CMP or consent UI to `consent(true)` and `consent(false)` in every stateful runtime
  when policy depends on user choice.
- Bind Node SDK calls with `forRequest()`; use `allowedEventTypes` only for intentionally permitted
  pre-consent server events, and never persist returned IDs unless
  `requestOptimization.canPersistProfile` is true.
- Clear active in-memory profile state with the runtime reset method and server profile cookies when
  revocation requires it.
- Use `consent({ events, persistence })` when event emission and durable profile continuity have
  separate consent choices.
- Keep mobile persisted consent aligned with account or CMP state across launches.
- Gate `identify()` traits and custom event properties before sending sensitive or restricted data.
- Apply the same consent, opt-out, and global privacy signal decisions before forwarding events to
  third-party destinations.
- Use the runtime's blocked-event diagnostic surface during validation to confirm denied events are
  blocked.
- Verify post-consent flows never replay suppressed interactions, and that page, screen, or flag
  current-state emitters send only fresh events for conditions that are still current.

## Related documentation

- [Integrating the Optimization Web SDK in a web app](../guides/integrating-the-web-sdk-in-a-web-app.md) -
  Web SDK initialization, consent defaults, event diagnostics, and browser storage boundaries.
- [Web SDK README](../../packages/web/web-sdk/README.md) - Package-level Web SDK configuration,
  consent, state streams, and tracking APIs.
- [Integrating the Optimization React Web SDK in a React app](../guides/integrating-the-react-web-sdk-in-a-react-app.md) -
  React Web providers, hooks, consent wiring, and blocked-event diagnostics.
- [React Web SDK README](../../packages/web/frameworks/react-web-sdk/README.md) - Package-level
  React Web provider, hook, state, and consent surfaces.
- [Integrating the Optimization Node SDK in a Node app](../guides/integrating-the-node-sdk-in-a-node-app.md) -
  Request-scoped consent, profile persistence, and server event behavior.
- [Node SDK README](../../packages/node/node-sdk/README.md) - Package-level Node SDK configuration,
  `forRequest()` usage, and stateless consent boundaries.
- [Core state management](./core-state-management.md) - Lower-level consent state, observables,
  queues, and runtime state mechanics.
- [Profile synchronization between client and server](./profile-synchronization-between-client-and-server.md) -
  Profile ID continuity, `ctfl-opt-aid`, and server-browser handoff.
- [Interaction tracking in Web SDKs](./interaction-tracking-in-web-sdks.md) - Web and React Web
  event gates, automatic tracking, queues, and diagnostics.
- [Interaction tracking in Node and stateless environments](./interaction-tracking-in-node-and-stateless-environments.md) -
  Request-scoped consent, stateless tracking, and server-side profile persistence.
- [Next.js SDK README](../../packages/web/frameworks/nextjs-sdk/README.md) - Adapter boundaries for
  server consent, ESR consent and persistence, request-context forwarding, and client consent.
- [React Native SDK interaction tracking mechanics](./react-native-sdk-interaction-tracking-mechanics.md) -
  React Native consent, AsyncStorage persistence, offline delivery, and tracking behavior.
- [iOS SDK runtime and interaction mechanics](./ios-sdk-runtime-and-interaction-mechanics.md) - iOS
  consent, UserDefaults persistence, streams, preview behavior, and offline delivery.
- [Android SDK runtime and interaction mechanics](./android-sdk-runtime-and-interaction-mechanics.md) -
  Android consent, SharedPreferences persistence, streams, preview behavior, and offline delivery.
- [Forwarding Optimization SDK context to analytics and tag management tools](../guides/forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md) -
  Consent-aware routing to third-party analytics and tag management destinations.
