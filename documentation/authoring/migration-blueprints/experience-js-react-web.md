---
migration: experience-js
archetype: migration
source: ../../internal/migration-knowledge/experience-js.md
guide: ../../guides/migrating-experience-js-react-to-react-web.md
---

# experience.js React to React Web migration blueprint

## Reader goal

- **Use when:** A React app uses `@ninetailed/experience.js-react` provider, hooks, components, or
  flags.
- **Target result:** The app uses the React Web provider, `OptimizedEntry`, target hooks, and
  app-owned consent/identity policy.
- **Guide file:** `documentation/guides/migrating-experience-js-react-to-react-web.md`
- **Write after:** `migrating-experience-js-to-the-web-sdk.md` only if the app also owns a custom
  lower-level Web adapter.
- **First verification:** One page event is accepted or intentionally blocked and one all-visitors
  `OptimizedEntry` renders a variant or baseline fallback.

## Migration route

| Legacy surface                         | Target route                                  | Detail owner                                                                                  |
| -------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `NinetailedProvider`                   | React Web `OptimizationProvider` composition  | [React Web blueprint](../blueprints/react-web.md)                                             |
| `Personalize`, `Experience`, and hooks | `OptimizedEntry` and target state hooks       | [React Web rendering](../../internal/sdk-knowledge/web/react-web.md#render--entry-resolution) |
| Legacy flag hooks                      | Target flag reads and manual flag-view route  | [Shared flag views](../../internal/sdk-knowledge/shared/concepts.md#custom-flag-views)        |
| Legacy plugin behavior                 | Supplemental plugin/privacy/preview migration | `migrating-experience-js-plugins-and-preview.md`                                              |

## Section plan

| Section                                           | Purpose                                                                                             | Must route to                                                               | Fact sources                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inventory provider, hooks, and render components  | Separate root wiring from component-level replacement work.                                         | Legacy React facts and target provider setup.                               | [React legacy](../../internal/migration-knowledge/experience-js.md#react-render-and-hooks), [setup](../../internal/sdk-knowledge/web/react-web.md#setup--factory), [components](../../internal/sdk-knowledge/web/react-web.md#components--hooks)                                                                                                |
| Replace the provider and readiness model          | Move root setup and async readiness without keeping legacy global assumptions.                      | React Web provider and readiness sections.                                  | [legacy runtime](../../internal/migration-knowledge/experience-js.md#legacy-runtime-surfaces), [runtime](../../internal/sdk-knowledge/web/react-web.md#version--runtime-quirks), [fallback](../../internal/sdk-knowledge/web/react-web.md#failure--fallback-behavior)                                                                           |
| Replace personalized entry rendering              | Route legacy component/hook rendering to entry resolution and target render props.                  | React Web entry rendering guide section plus content-model migration guide. | [React legacy](../../internal/migration-knowledge/experience-js.md#react-render-and-hooks), [content model](../../internal/migration-knowledge/experience-js.md#contentful-model-and-mapper), [rendering](../../internal/sdk-knowledge/web/react-web.md#render--entry-resolution)                                                               |
| Replace flags and tracking side effects           | Make flag-view behavior and interaction tracking explicit instead of preserving hook names.         | Flag-view facts, React Web events, and target hooks.                        | [React legacy](../../internal/migration-knowledge/experience-js.md#react-render-and-hooks), [flag views](../../internal/sdk-knowledge/shared/concepts.md#custom-flag-views), [events](../../internal/sdk-knowledge/web/react-web.md#events--tracking)                                                                                           |
| Replace consent, identity, analytics, and preview | Keep policy/vendor-specific work out of the core render migration.                                  | React Web policy sections and supplemental plugin guide.                    | [identifiers](../../internal/migration-knowledge/experience-js.md#identifiers-and-persistence), [plugins](../../internal/migration-knowledge/experience-js.md#plugins-and-preview), [consent](../../internal/sdk-knowledge/web/react-web.md#consent--persistence), [preview](../../internal/sdk-knowledge/shared/concepts.md#preview-overrides) |
| Validate React migration                          | Verify provider placement, rendered variant/baseline, event stream, and absence of legacy wrappers. | React Web production checks and troubleshooting.                            | [events](../../internal/sdk-knowledge/web/react-web.md#events--tracking), [fallback](../../internal/sdk-knowledge/web/react-web.md#failure--fallback-behavior), [event streams](../../internal/sdk-knowledge/shared/concepts.md#stateful-event-forwarding-streams)                                                                              |

## Handoffs

None.

## Link roles

- [React Web integration guide](../../guides/integrating-the-react-web-sdk-in-a-react-app.md).
- [Web SDK integration guide](../../guides/integrating-the-web-sdk-in-a-web-app.md).
- [React Web reference implementation](../../../implementations/react-web-sdk/README.md).
- [Contentful model migration guide](../../guides/migrating-experience-js-contentful-model-to-optimization.md).
- [Plugin, privacy, analytics, and preview migration guide](../../guides/migrating-experience-js-plugins-and-preview.md).
