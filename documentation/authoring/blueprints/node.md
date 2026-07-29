---
sdk: node
archetype: integration
kb: ../../internal/sdk-knowledge/node/node.md
guide: ../../guides/integrating-the-node-sdk-in-a-node-app.md
---

# Node guide blueprint

## Quick-start contract

- **Outcome:** One request emits an accepted page event and returns the profile identifier supplied
  by the Experience API.
- **Verification:** Run the server, request the route with `curl`, and inspect the JSON profile ID.
- **Reader shape:** A Node request handler that builds a response.
- **Required artifacts:** Package install; environment values; one runnable server module; one
  request; the `curl` verification.
- **Deliberate simplifications:** Consent is granted per request and profile persistence is deferred.
- **Explainer switches:** profile point = include; managed-fetch clause = include.
- **Fact sources:** [setup](../../internal/sdk-knowledge/node/node.md#setup--initialization-and-binding),
  [events](../../internal/sdk-knowledge/node/node.md#events--tracking),
  [runtime](../../internal/sdk-knowledge/node/node.md#version--runtime-quirks).

## Milestone contract

- **Milestone 1:** Accepted page evaluation and a request profile without authored content.
- **Milestone 2:** Resolve a Contentful entry using the request's selections.
- **Boundary:** Work that can be verified before authoring a variant versus personalized rendering.
- **Fact sources:** [events](../../internal/sdk-knowledge/node/node.md#events--tracking),
  [rendering](../../internal/sdk-knowledge/node/node.md#render--entry-resolution).

## Section map

| Section                                                 | Category                       | Purpose                                                      | Must teach or show                                                                    | Fact sources                                                                                                                                                      |
| ------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install and initialize the Node SDK                     | Required for first integration | Establish the process-level instance before request work.    | Complete initialization module; environment ownership; one-instance rule.             | [setup](../../internal/sdk-knowledge/node/node.md#setup--initialization-and-binding)                                                                              |
| Bind request context and locale                         | Required for first integration | Teach the request-scoped inputs every later call consumes.   | Request-to-context adapter; locale precedence; ownership statement.                   | [events](../../internal/sdk-knowledge/node/node.md#events--tracking), [runtime](../../internal/sdk-knowledge/node/node.md#version--runtime-quirks)                |
| Apply consent policy                                    | Common but policy-dependent    | Replace the quick-start shortcut with application policy.    | Boolean and split-axis forms; blocked result; app-owned policy seam.                  | [consent](../../internal/sdk-knowledge/node/node.md#consent--persistence)                                                                                         |
| Evaluate route requests with `page()`                   | Required for first integration | Explain the main request evaluation and its result envelope. | Request example; result-field glossary; accepted-versus-blocked branch.               | [events](../../internal/sdk-knowledge/node/node.md#events--tracking)                                                                                              |
| Identify known users                                    | Common but policy-dependent    | Place authentication identity in the request sequence.       | Identify-before-page sequence and app-owned traits example.                           | [events](../../internal/sdk-knowledge/node/node.md#events--tracking)                                                                                              |
| Persist profile identity between requests               | Common but policy-dependent    | Make continuity explicit for a stateless SDK.                | Read/write lifecycle; consent gate; cookie ownership and hybrid note.                 | [identifiers](../../internal/sdk-knowledge/node/node.md#identifier-ownership), [consent](../../internal/sdk-knowledge/node/node.md#consent--persistence)          |
| Fetch and resolve Contentful entries                    | Required for first integration | Turn request selections into rendered content.               | Managed and manual paths; result field distinction; fallback; mutation/cache warning. | [rendering](../../internal/sdk-knowledge/node/node.md#render--entry-resolution), [fallback](../../internal/sdk-knowledge/node/node.md#failure--fallback-behavior) |
| Resolve merge tags                                      | Optional                       | Cover profile-backed Rich Text substitution.                 | Guard/resolver example and fallback behavior.                                         | [rendering](../../internal/sdk-knowledge/node/node.md#render--entry-resolution)                                                                                   |
| Read Custom Flags                                       | Optional                       | Cover authored flag changes without implying event emission. | Flag read example and side-effect boundary.                                           | [rendering](../../internal/sdk-knowledge/node/node.md#render--entry-resolution)                                                                                   |
| Track server-side interactions and business events      | Optional                       | Separate server-owned tracking from browser interactions.    | `track()` and `trackView()` examples; profile requirement.                            | [events](../../internal/sdk-knowledge/node/node.md#events--tracking)                                                                                              |
| Forward optimization context to analytics               | Optional                       | Hand off to the supplemental workflow.                       | Context fields and supplemental-guide link.                                           | [events](../../internal/sdk-knowledge/node/node.md#events--tracking)                                                                                              |
| Share continuity with the Web SDK                       | Optional                       | Explain the cross-runtime profile handoff.                   | Shared-cookie contract; duplicate-page ownership; reference link.                     | [identifiers](../../internal/sdk-knowledge/node/node.md#identifier-ownership)                                                                                     |
| Control pre-consent event admission and request options | Advanced or production-only    | Expose strict policy and diagnostics after the default flow. | Empty allow-list; blocked callback; request-scoped options.                           | [consent](../../internal/sdk-knowledge/node/node.md#consent--persistence), [runtime](../../internal/sdk-knowledge/node/node.md#version--runtime-quirks)           |
| Keep caches safe for personalized rendering             | Advanced or production-only    | Prevent visitor-specific output from entering shared caches. | Cache-safety table and cache-key boundary.                                            | [runtime](../../internal/sdk-knowledge/node/node.md#version--runtime-quirks)                                                                                      |

## SDK-specific authoring overrides

- Use a server `process.env` note rather than the recipe's browser-visible environment convention.
- Do not force a React render-prop example into this guide; explain the generic returned-entry type
  and mutation boundary instead. Facts:
  [rendering](../../internal/sdk-knowledge/node/node.md#render--entry-resolution).

## Troubleshooting scope

| Reader symptom                                              | Why it belongs                      | Fact sources                                                                     |
| ----------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| Entry stays on baseline or authored variant never appears   | Most common resolution ambiguity.   | [fallback](../../internal/sdk-knowledge/node/node.md#failure--fallback-behavior) |
| `page()` is not accepted                                    | Exposes consent admission directly. | [consent](../../internal/sdk-knowledge/node/node.md#consent--persistence)        |
| Insights view lacks a request profile                       | Common sequencing error.            | [events](../../internal/sdk-knowledge/node/node.md#events--tracking)             |
| Profile changes between requests or runtimes                | Continuity is application-owned.    | [identifiers](../../internal/sdk-knowledge/node/node.md#identifier-ownership)    |
| Merge-tag output or personalized output leaks through cache | High-impact production failure.     | [runtime](../../internal/sdk-knowledge/node/node.md#version--runtime-quirks)     |

## Link roles

- [The Web SDK integration guide](../../guides/integrating-the-web-sdk-in-a-web-app.md).
- [The analytics-forwarding supplemental guide](../../guides/forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).
- [The maintained Node-only reference implementation](../../../implementations/node-sdk/README.md).
- [The maintained Node-plus-Web reference implementation](../../../implementations/node-sdk+web-sdk/README.md).
