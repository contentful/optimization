---
sdk: react-native
archetype: integration
kb: ../../internal/sdk-knowledge/native/react-native.md
guide: ../../guides/integrating-the-react-native-sdk-in-a-react-native-app.md
---

# React Native guide blueprint

## Quick-start contract

- **Outcome:** One screen renders an entry through `OptimizedEntry` and emits one accepted screen
  event.
- **Verification:** Observe rendered baseline-or-variant content and the accepted screen event in
  Metro or device logs.
- **Reader shape:** A React Native screen that fetches or receives a Contentful entry.
- **Required artifacts:** Package and peer installs; native build step; root-provider diff; one
  screen/entry example; visible event diagnostics; verification.
- **Deliberate simplifications:** Consent starts granted and managed fetching leads.
- **Explainer switches:** profile point = include; managed-fetch clause = include.
- **Fact sources:** [setup](../../internal/sdk-knowledge/native/react-native.md#setup--initialization-and-binding),
  [rendering](../../internal/sdk-knowledge/native/react-native.md#render--entry-resolution),
  [events](../../internal/sdk-knowledge/native/react-native.md#events--tracking).

## Milestone contract

- **Milestone 1:** Minimum provider, entry render, and screen event.
- **Milestone 2:** Policy-dependent and optional layers such as consent, identity, interactions,
  live updates, preview, offline delivery, and analytics.
- **Boundary:** Mandatory first wiring versus opt-in application policy and capabilities.
- **Fact sources:** [runtime](../../internal/sdk-knowledge/native/react-native.md#version--runtime-quirks).

## Section map

| Section                                    | Category                       | Purpose                                                          | Must teach or show                                                                     | Fact sources                                                                                                                                                                          |
| ------------------------------------------ | ------------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install and initialize `OptimizationRoot`  | Required for first integration | Establish the native provider tree and async initialization.     | Install/build commands; root diff; readiness behavior; single-runtime rule.            | [setup](../../internal/sdk-knowledge/native/react-native.md#setup--initialization-and-binding)                                                                                        |
| Consent and privacy-policy handoff         | Common but policy-dependent    | Replace the quick-start shortcut and explain native persistence. | Two-axis example; pre-consent events; app-owned policy.                                | [consent](../../internal/sdk-knowledge/native/react-native.md#consent--persistence)                                                                                                   |
| Contentful entry fetching and locale shape | Required for first integration | Establish manual and managed entry sources.                      | Both paths; locale/include requirements; client ownership.                             | [rendering](../../internal/sdk-knowledge/native/react-native.md#render--entry-resolution)                                                                                             |
| Entry resolution and fallback rendering    | Required for first integration | Complete the entry half of Milestone 1.                          | Render-prop example and cast; static-child option; loading/error/fallback distinction. | [rendering](../../internal/sdk-knowledge/native/react-native.md#render--entry-resolution), [fallback](../../internal/sdk-knowledge/native/react-native.md#failure--fallback-behavior) |
| Screen and navigation tracking             | Required for first integration | Complete the event half of Milestone 1 using native vocabulary.  | Hook and navigation-adapter paths; choose-one-path warning.                            | [events](../../internal/sdk-knowledge/native/react-native.md#events--tracking)                                                                                                        |
| Entry interaction tracking                 | Common but policy-dependent    | Explain viewport-based views and taps.                           | Scroll provider; thresholds; tap versus scroll behavior; opt-outs.                     | [events](../../internal/sdk-knowledge/native/react-native.md#events--tracking)                                                                                                        |
| Identity, profile continuity, and reset    | Common but policy-dependent    | Integrate login/logout and AsyncStorage continuity.              | Identify/reset example; persistence behavior; no-cookie-handoff note.                  | [consent](../../internal/sdk-knowledge/native/react-native.md#consent--persistence), [identifiers](../../internal/sdk-knowledge/native/react-native.md#identifier-ownership)          |
| Merge tags and Custom Flags                | Optional                       | Cover content-model-dependent reads.                             | Merge-tag and flag examples.                                                           | [rendering](../../internal/sdk-knowledge/native/react-native.md#render--entry-resolution)                                                                                             |
| Live updates                               | Optional                       | Allow mounted entries to re-resolve.                             | Root and per-entry scopes; locked-by-default explanation.                              | [runtime](../../internal/sdk-knowledge/native/react-native.md#version--runtime-quirks)                                                                                                |
| Preview panel                              | Optional                       | Add the native authoring/debug surface.                          | Peer installs; custom-dev-build requirement; overlay placement.                        | [runtime](../../internal/sdk-knowledge/native/react-native.md#version--runtime-quirks)                                                                                                |
| Offline event delivery                     | Optional                       | Explain constrained-network delivery.                            | NetInfo setup; in-memory queue boundary; restart caveat.                               | [events](../../internal/sdk-knowledge/native/react-native.md#events--tracking)                                                                                                        |
| Analytics forwarding                       | Optional                       | Hand off to the supplemental workflow.                           | State subscription seam; guide link.                                                   | [events](../../internal/sdk-knowledge/native/react-native.md#events--tracking)                                                                                                        |
| Explicit SDK runtime ownership             | Advanced or production-only    | Support adapters and tests that must initialize before React.    | Initialize/destroy lifecycle and single-runtime rule.                                  | [setup](../../internal/sdk-knowledge/native/react-native.md#setup--initialization-and-binding)                                                                                        |
| Strict event admission and queue controls  | Advanced or production-only    | Expose production privacy and delivery posture.                  | Empty allow-list; blocked callback; queue policy.                                      | [consent](../../internal/sdk-knowledge/native/react-native.md#consent--persistence)                                                                                                   |
| Platform build boundaries                  | Advanced or production-only    | Collect native-only build and host constraints.                  | Expo/bare distinction; emulator host override; release validation.                     | [runtime](../../internal/sdk-knowledge/native/react-native.md#version--runtime-quirks)                                                                                                |

## SDK-specific authoring overrides

- Use screen/tap/viewport language throughout; never import page/click/hover vocabulary from web.
  Facts: [events](../../internal/sdk-knowledge/native/react-native.md#events--tracking).
- Keep the native build step in the quick start, even though deeper platform constraints belong in
  Advanced. Facts: [setup](../../internal/sdk-knowledge/native/react-native.md#setup--initialization-and-binding).

## Troubleshooting scope

| Reader symptom                                   | Why it belongs                                                     | Fact sources                                                                                                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider children do not render                  | Native initialization and single-instance failures block the tree. | [fallback](../../internal/sdk-knowledge/native/react-native.md#failure--fallback-behavior)                                                                             |
| Entry stays on baseline or has a type error      | Common payload and renderer symptoms.                              | [rendering](../../internal/sdk-knowledge/native/react-native.md#render--entry-resolution)                                                                              |
| View/tap/screen events are missing or duplicated | Makes viewport, consent, and choose-one-path rules actionable.     | [events](../../internal/sdk-knowledge/native/react-native.md#events--tracking)                                                                                         |
| Preview or offline replay fails                  | Common peer/build/process-lifetime boundaries.                     | [runtime](../../internal/sdk-knowledge/native/react-native.md#version--runtime-quirks), [events](../../internal/sdk-knowledge/native/react-native.md#events--tracking) |

## Link roles

- [The analytics-forwarding supplemental guide](../../guides/forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).
- [The maintained React Native reference implementation](../../../implementations/react-native-sdk/README.md).
