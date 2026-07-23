---
migration: experience-js
archetype: migration
source: ../../internal/migration-knowledge/experience-js.md
guide: ../../guides/migrating-experience-js-plugins-and-preview.md
---

# experience.js plugins, privacy, analytics, and preview migration blueprint

## Reader goal

- **Use when:** An app uses experience.js analytics, privacy, preview, insights, or third-party
  plugin packages.
- **Target result:** The app replaces plugin packages with target SDK consent policy, event streams,
  preview panel, insights behavior, and vendor-specific forwarding code where needed.
- **Guide file:** `documentation/guides/migrating-experience-js-plugins-and-preview.md`
- **Write after:** At least one runtime migration guide for the app's target runtime.
- **First verification:** The target runtime shows one accepted event, one blocked diagnostic, and
  preview behavior without legacy plugin globals.

## Migration route

| Legacy surface                    | Target route                                     | Detail owner                                                                                                            |
| --------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Privacy plugin                    | App-owned consent plus target SDK consent inputs | Runtime integration guide consent sections                                                                              |
| Analytics and vendor plugins      | Event-stream forwarding or target insights       | [Analytics forwarding guide](../../guides/forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md) |
| Preview plugin and preview bridge | Optimization preview panel and override behavior | Target runtime preview sections                                                                                         |
| Insights plugin batching          | Target event delivery and forwarding seams       | Runtime integration guide events sections                                                                               |

## Section plan

| Section                                   | Purpose                                                                                                           | Must route to                                                              | Fact sources                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inventory plugin packages and globals     | Make plugin replacement explicit and prevent one-for-one package assumptions.                                     | Legacy plugin and unsupported-boundary facts.                              | [plugins](../../internal/migration-knowledge/experience-js.md#plugins-and-preview), [unsupported boundaries](../../internal/migration-knowledge/experience-js.md#unsupported-or-manual-migration-boundaries)                                                                                                                                                                          |
| Replace privacy plugin behavior           | Route consent storage, accepted/blocked behavior, and queue expectations to target app-owned policy.              | Runtime consent sections and blocked-event diagnostics.                    | [legacy identifiers](../../internal/migration-knowledge/experience-js.md#identifiers-and-persistence), [plugins](../../internal/migration-knowledge/experience-js.md#plugins-and-preview), [shared consent](../../internal/sdk-knowledge/shared/concepts.md#consent--persistence), [event streams](../../internal/sdk-knowledge/shared/concepts.md#stateful-event-forwarding-streams) |
| Replace analytics and tag-manager plugins | Route vendor forwarding to the supplemental analytics guide instead of recreating plugin packages.                | Event stream forwarding, dedupe, blocked diagnostics, and vendor examples. | [plugins](../../internal/migration-knowledge/experience-js.md#plugins-and-preview), [event streams](../../internal/sdk-knowledge/shared/concepts.md#stateful-event-forwarding-streams), [Web events](../../internal/sdk-knowledge/web/web.md#events--tracking), [React Web events](../../internal/sdk-knowledge/web/react-web.md#events--tracking)                                    |
| Replace preview plugin behavior           | Route authoring/debugging behavior to the target preview panel and clearly identify parity boundaries.            | Runtime preview sections and shared preview override facts.                | [plugins](../../internal/migration-knowledge/experience-js.md#plugins-and-preview), [preview overrides](../../internal/sdk-knowledge/shared/concepts.md#preview-overrides), [Web runtime](../../internal/sdk-knowledge/web/web.md#version--runtime-quirks), [React Web runtime](../../internal/sdk-knowledge/web/react-web.md#version--runtime-quirks)                                |
| Validate plugin migration                 | Verify consent-blocked diagnostics, accepted forwarding, preview attachment, and removed legacy globals/packages. | Runtime guide production checks and analytics supplemental validation.     | [event streams](../../internal/sdk-knowledge/shared/concepts.md#stateful-event-forwarding-streams), [preview overrides](../../internal/sdk-knowledge/shared/concepts.md#preview-overrides), [Web consent](../../internal/sdk-knowledge/web/web.md#consent--persistence), [React Web consent](../../internal/sdk-knowledge/web/react-web.md#consent--persistence)                      |

## Handoffs

None.

## Link roles

- [Analytics forwarding supplemental guide](../../guides/forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).
- [Consent management concept](../../concepts/consent-management-in-the-optimization-sdk-suite.md).
- [Web SDK integration guide](../../guides/integrating-the-web-sdk-in-a-web-app.md).
- [React Web integration guide](../../guides/integrating-the-react-web-sdk-in-a-react-app.md).
- [Next.js App Router integration guide](../../guides/integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md).
- [Next.js Pages Router integration guide](../../guides/integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md).
