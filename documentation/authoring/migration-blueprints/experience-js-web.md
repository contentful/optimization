---
migration: experience-js
archetype: migration
source: ../../internal/migration-knowledge/experience-js.md
guide: ../../guides/migrating-experience-js-to-the-web-sdk.md
---

# experience.js to Web SDK migration blueprint

## Reader goal

- **Use when:** A plain browser or custom JavaScript adapter uses `@ninetailed/experience.js`.
- **Target result:** The app owns one Optimization Web SDK instance, emits page events, resolves
  Contentful entries, and replaces legacy plugin behavior through current SDK seams.
- **Guide file:** `documentation/guides/migrating-experience-js-to-the-web-sdk.md`
- **Write after:** None.
- **First verification:** One accepted page event populates selections and one all-visitors
  Optimization-authored entry renders before policy-dependent replacements.

## Migration route

| Legacy surface                          | Target route                                              | Detail owner                                                                   |
| --------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Browser `Ninetailed` client             | Web SDK setup, lifecycle, events, and state subscriptions | [Web integration blueprint](../blueprints/web.md)                              |
| Legacy profile globals and storage keys | Target identifier and persistence policy                  | [Web SDK KB](../../internal/sdk-knowledge/web/web.md#identifier-ownership)     |
| `Personalize`-like manual rendering     | Entry resolution and Web Components where useful          | [Web SDK KB](../../internal/sdk-knowledge/web/web.md#render--entry-resolution) |
| Plugin analytics, privacy, and preview  | Supplemental migration guides                             | `migrating-experience-js-plugins-and-preview.md`                               |

## Section plan

| Section                                        | Purpose                                                                                                            | Must route to                                                       | Fact sources                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Inventory the legacy browser integration       | Help the reader find the single client, event calls, plugins, and Contentful resolution boundary before editing.   | Legacy client, storage, and package mapping; target Web setup.      | [package mapping](../../internal/migration-knowledge/experience-js.md#package-mapping), [legacy runtime](../../internal/migration-knowledge/experience-js.md#legacy-runtime-surfaces), [setup](../../internal/sdk-knowledge/web/web.md#setup--factory)                                                                                                                                     |
| Replace client construction and lifecycle      | Move from legacy client/plugin construction to one Web SDK instance without preserving legacy plugin arrays.       | Web SDK integration guide lifecycle sections.                       | [legacy runtime](../../internal/migration-knowledge/experience-js.md#legacy-runtime-surfaces), [Web runtime](../../internal/sdk-knowledge/web/web.md#version--runtime-quirks)                                                                                                                                                                                                              |
| Replace page, track, identify, and reset calls | Map imperative event calls and identity lifecycle to target event and consent ownership.                           | Web events, consent, identity, and reset sections.                  | [legacy runtime](../../internal/migration-knowledge/experience-js.md#legacy-runtime-surfaces), [identifiers](../../internal/migration-knowledge/experience-js.md#identifiers-and-persistence), [events](../../internal/sdk-knowledge/web/web.md#events--tracking), [consent](../../internal/sdk-knowledge/web/web.md#consent--persistence)                                                 |
| Replace entry and flag rendering               | Move legacy mapped experience configs and flag reads to Optimization content-model entry resolution and flag APIs. | Web rendering plus content-model migration guide for authored data. | [content model](../../internal/migration-knowledge/experience-js.md#contentful-model-and-mapper), [unsupported boundaries](../../internal/migration-knowledge/experience-js.md#unsupported-or-manual-migration-boundaries), [rendering](../../internal/sdk-knowledge/web/web.md#render--entry-resolution), [flag views](../../internal/sdk-knowledge/shared/concepts.md#custom-flag-views) |
| Validate browser migration                     | Verify rendered variant or baseline, accepted events, blocked diagnostics, and removal of legacy packages.         | Web production checks and troubleshooting.                          | [events](../../internal/sdk-knowledge/web/web.md#events--tracking), [fallback](../../internal/sdk-knowledge/web/web.md#failure--fallback-behavior), [event streams](../../internal/sdk-knowledge/shared/concepts.md#stateful-event-forwarding-streams)                                                                                                                                     |

## Handoffs

None.

## Link roles

- [Web SDK integration guide](../../guides/integrating-the-web-sdk-in-a-web-app.md).
- [Analytics forwarding supplemental guide](../../guides/forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).
- [Vanilla Web reference implementation](../../../implementations/web-sdk/README.md).
- [Plugin, privacy, analytics, and preview migration guide](../../guides/migrating-experience-js-plugins-and-preview.md).
- [Contentful model migration guide](../../guides/migrating-experience-js-contentful-model-to-optimization.md).
