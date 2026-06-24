---
title: Consent management in the Optimization SDK Suite
---

# Consent management in the Optimization SDK Suite

Use this document to design consent flows that use the Optimization SDK Suite without treating the
SDK as the policy engine. It explains how the SDK stores and applies consent, how consumers can map
consent management platform (CMP) decisions into SDK configuration, and how common regulatory
expectations affect integration choices.

This document is engineering guidance, not legal advice. Your application owns legal interpretation,
jurisdiction detection, CMP behavior, consent records, privacy notices, and downstream destination
policy. The SDK provides controls that can support a compliant implementation, but those controls do
not make an application compliant by themselves.

For lower-level state mechanics, see [Core state management](./core-state-management.md). For
profile ID and cookie continuity, see
[Profile synchronization between client and server](./profile-synchronization-between-client-and-server.md).
For third-party analytics routing, see
[Forwarding Optimization SDK context to analytics and tag management tools](../guides/forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [The consent responsibility model](#the-consent-responsibility-model)
- [SDK consent behavior](#sdk-consent-behavior)
  - [Stateful SDKs](#stateful-sdks)
  - [Node and stateless runtimes](#node-and-stateless-runtimes)
  - [Event allow-lists and blocked events](#event-allow-lists-and-blocked-events)
  - [Revocation and profile cleanup](#revocation-and-profile-cleanup)
- [Configure consent flows](#configure-consent-flows)
  - [Map CMP choices to SDK state](#map-cmp-choices-to-sdk-state)
  - [Choose a pre-consent posture](#choose-a-pre-consent-posture)
  - [Keep server and browser policy aligned](#keep-server-and-browser-policy-aligned)
  - [Align third-party destinations](#align-third-party-destinations)
- [Regulatory expectations and SDK configuration](#regulatory-expectations-and-sdk-configuration)
  - [Shared implementation principles](#shared-implementation-principles)
  - [Regional considerations](#regional-considerations)
- [Engineering checklist](#engineering-checklist)

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

The SDK exposes event consent as its compatibility consent state and supports an optional separate
persistence consent state for durable profile continuity. If your CMP uses separate categories for
personalization, analytics, advertising, and third-party sharing, map those categories before
calling `consent(true)` or `consent({ events, persistence })`. If one SDK event type or downstream
destination is not permitted, keep the SDK denied for that flow and gate the affected method calls
or forwarding code in the application layer.

## SDK consent behavior

### Stateful SDKs

Stateful SDKs include the Web SDK, React Web SDK, React Native SDK, iOS SDK, and Android SDK. They
hold event consent as one of three values:

| Consent value | Meaning                                                                       |
| ------------- | ----------------------------------------------------------------------------- |
| `undefined`   | No SDK consent decision has been set in this runtime.                         |
| `true`        | The SDK can emit all configured event types.                                  |
| `false`       | The SDK blocks event types that are not present in the configured allow-list. |

Stateful SDKs persist event consent in their platform storage so later visits or app launches can
restore the decision. They also persist a separate profile-continuity persistence consent value when
one is set. Browser SDKs use localStorage and can also use the readable `ctfl-opt-aid` cookie for
profile continuity. React Native persists with AsyncStorage. Native iOS and Android SDKs persist
with UserDefaults and SharedPreferences.

Stateful SDKs initialize early enough to support first-render personalization, but they restore
storage in two steps. On startup, the SDK reads consent and preference state first. It reads durable
profile continuity, such as profile IDs, cached profile data, selected optimizations, and mobile
profile-continuity state, only after persistence consent resolves to `true`. If persistence consent
resolves to `false`, the SDK clears SDK-managed durable profile-continuity storage. If persistence
consent is `undefined`, the SDK does not restore durable profile continuity.

Use `defaults.consent: true` or native `StorageDefaults(consent: true)` when the application policy
permits the SDK to start in an accepted state, including integrations that do not render an end-user
consent UI. This starts all gated SDK events immediately and permits durable profile continuity.
Existing boolean consent calls map to both event and persistence consent. Use
`consent({ events: true, persistence: false })` when events are allowed but durable profile
continuity must remain session-only. For production consent prompts, leave consent unset and call
`consent(true)`, `consent(false)`, or object-form consent from the CMP or banner callback.

### Node and stateless runtimes

The Node SDK does not store consent. When the application policy permits Optimization by default,
bind each request with accepted event and persistence consent:

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
narrow allowlist when legal review approves a specific pre-consent server event. Do not persist the
returned profile ID unless request persistence consent is true:

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

Use the allow-list as a policy mapping tool:

- Set `allowedEventTypes: []` when no Optimization event can emit before consent.
- Remove `identify` from the allow-list when profile mutation is not allowed before consent.
- Keep only the event types that your legal and privacy review permits for the purpose and region.

The allow-list only controls event emission. It does not control when a CMP renders, when browser
storage is read, when a server writes cookies, whether a user has received a valid notice, or
whether a third-party destination can receive mirrored events.

Allow-listed events can emit before event consent is granted, but their SDK-built payloads mark
`context.gdpr.isConsentGiven` as `false` until event consent is explicitly `true`.

When the consent guard blocks an event, the SDK writes blocked-event metadata and calls the
configured `onEventBlocked` callback. You can also subscribe to `states.blockedEventStream` in
stateful JavaScript SDKs. Blocked events are dropped at the SDK boundary and are not replayed after
`consent(true)`. Do not store or resend suppressed interaction events such as clicks, taps, hovers,
or custom interactions.

SDK-owned current-state surfaces can still emit a fresh event after consent when the underlying
condition is still current and the event has not already been accepted. Automatic page or screen
trackers can emit the active page or screen after tracking becomes allowed, and active flag
subscriptions can emit a flag-view event for the current flag value. Those emissions represent the
current application state after consent, not replay of the previously blocked event.

### Revocation and profile cleanup

Calling `consent(false)` blocks future non-allowed events in stateful clients and purges queued SDK
Experience and Insights events. It also clears SDK-managed durable profile-continuity storage. It
leaves the current in-memory profile, selected optimizations, and changes untouched so the
application can decide whether the active session should reset. It does not erase the consent record
in your CMP, clear server cookies, delete Contentful-side profile data, or remove application-owned
profile continuity.

When withdrawal must stop both future events and profile continuity:

- Call `consent(false)` so the SDK blocks future gated events.
- Call `reset()` in Web or React Web flows when profile, selected optimizations, changes, and the
  in-memory browser anonymous ID need to be cleared during the active session.
- Clear application-owned cookies, sessions, and server-side profile IDs, including any
  server-managed `ctfl-opt-aid` value.
- Stop Node SDK calls until request-scoped consent permits them again.
- Apply the same withdrawal state to third-party analytics, advertising, tag management, and data
  warehouse destinations.

If withdrawal also requires deletion or suppression in external systems, implement those flows
outside the SDK with the systems that store the data.

## Configure consent flows

### Map CMP choices to SDK state

Treat the CMP or application preference service as the source of truth. The SDK receives the result:

```ts
cmp.onChange((choice) => {
  const optimizationAllowed = choice.purposes.personalization && choice.purposes.analytics

  optimization.consent(optimizationAllowed)
})
```

When event emission and durable profile continuity are separate CMP choices, pass only the fields
that changed:

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

### Choose a pre-consent posture

There are three common implementation postures:

| Posture                         | SDK configuration                                                                                                                                   | Use when                                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Strict opt-in**               | Initialize with `allowedEventTypes: []`, no `defaults.consent`, and no accepted persistence consent.                                                | Policy does not permit non-essential event emission or durable profile-continuity storage before opt-in.                         |
| **Limited pre-consent context** | Leave consent unset and use the runtime's default or custom `allowedEventTypes`; keep persistence consent unset or false.                           | Legal review permits specific first-party context events before broader tracking consent.                                        |
| **Default-on accepted context** | Seed `defaults.consent: true` or native storage defaults; set `defaults.persistenceConsent: false` only when profile continuity should be deferred. | Application policy permits SDK event emission and profile continuity at startup, with or without a separate end-user consent UI. |

For browser applications, storage policy can matter as much as event policy. If legal review treats
SDK localStorage or the `ctfl-opt-aid` cookie as non-essential before opt-in, keep persistence
consent unset or false and avoid server-set anonymous cookies until the CMP allows them.
`allowedEventTypes: []` prevents event emission, while persistence consent controls whether the SDK
restores durable profile-continuity storage. The SDK still does not own browser storage policy,
server-set cookies, or CMP records.

### Keep server and browser policy aligned

Hybrid applications often run the Node SDK on the server and the Web or React Web SDK in the
browser. Use the same consent decision on both sides:

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
- Leave SDK consent unset, use `allowedEventTypes: []`, or defer browser SDK initialization when
  pre-consent events, localStorage access, or cookies are not permitted.
- Use `defaults.consent: true` only when application policy permits accepted SDK startup, such as a
  valid existing consent record or a default-on policy.
- Call `consent(false)` on refusal or withdrawal to block gated events, purge SDK queues, and clear
  SDK-managed durable profile continuity. Call `reset()` plus application cookie cleanup when
  withdrawal must also clear the active in-memory profile.
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
- Clear active in-memory profile state with `reset()` and server profile cookies when revocation
  requires it.
- Use `consent({ events, persistence })` when event emission and durable profile continuity have
  separate consent choices.
- Keep mobile persisted consent aligned with account or CMP state across launches.
- Gate `identify()` traits and custom event properties before sending sensitive or restricted data.
- Apply the same consent, opt-out, and global privacy signal decisions before forwarding events to
  third-party destinations.
- Subscribe to `states.blockedEventStream` or use `onEventBlocked` during validation to confirm
  denied events are blocked.
- Verify post-consent flows never replay suppressed interactions, and that page, screen, or flag
  current-state emitters send only fresh events for conditions that are still current.
