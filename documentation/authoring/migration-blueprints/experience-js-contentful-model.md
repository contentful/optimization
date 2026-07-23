---
migration: experience-js
archetype: migration
source: ../../internal/migration-knowledge/experience-js.md
guide: ../../guides/migrating-experience-js-contentful-model-to-optimization.md
---

# experience.js Contentful model migration blueprint

## Reader goal

- **Use when:** A space uses Ninetailed Contentful experience entries, mapper utilities, or
  baseline entries linked to legacy `nt_*` fields.
- **Target result:** The reader understands which authored data must move to the Optimization
  content model before runtime migration can verify personalized entries.
- **Guide file:** `documentation/guides/migrating-experience-js-contentful-model-to-optimization.md`
- **Write after:** None; runtime migration guides should link here before entry-rendering steps.
- **First verification:** One baseline entry and one authored all-visitors variant resolve in a
  target runtime before broader runtime migration.

## Migration route

| Legacy surface                                      | Target route                                                    | Detail owner                                              |
| --------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| `@ninetailed/experience.js-utils-contentful` mapper | Built-in Optimization content model and target entry resolution | Runtime integration guide rendering sections              |
| Legacy `nt_*` fields                                | Optimization-authored experiences and variants                  | Contentful product documentation plus target rendering KB |
| Custom mapper functions                             | App-owned content adaptation before target SDK entry resolution | This migration guide plus runtime rendering sections      |

## Section plan

| Section                                            | Purpose                                                                                                      | Must route to                                                                 | Fact sources                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Inventory legacy authored entries and mapper usage | Find the Contentful data that cannot be preserved as runtime config arrays.                                  | Legacy model and mapper facts.                                                | [content model](../../internal/migration-knowledge/experience-js.md#contentful-model-and-mapper), [unsupported boundaries](../../internal/migration-knowledge/experience-js.md#unsupported-or-manual-migration-boundaries)                                                                                                                                               |
| Plan target Optimization authoring                 | Route authoring work to Contentful product docs and target SDK entry-resolution requirements.                | Existing Contentful personalization docs and target rendering guide sections. | [entry-source boundary](../../internal/sdk-knowledge/shared/concepts.md#entry-source-boundary-managed-or-manual), [entry resolution](../../internal/sdk-knowledge/shared/concepts.md#entry-resolution), [baseline fallback](../../internal/sdk-knowledge/shared/concepts.md#baseline-fallback)                                                                           |
| Replace mapper-dependent runtime code              | Stop building legacy `ExperienceConfiguration` arrays and route runtime code to target SDK entry resolution. | Runtime-specific Web, React Web, Next.js, or Node rendering sections.         | [content model](../../internal/migration-knowledge/experience-js.md#contentful-model-and-mapper), [Web rendering](../../internal/sdk-knowledge/web/web.md#render--entry-resolution), [React Web rendering](../../internal/sdk-knowledge/web/react-web.md#render--entry-resolution), [Node rendering](../../internal/sdk-knowledge/node/node.md#render--entry-resolution) |
| Validate content migration before code migration   | Make the first runtime verification performable by checking authored variants and fallback expectations.     | Target runtime quick start and troubleshooting.                               | [baseline fallback](../../internal/sdk-knowledge/shared/concepts.md#baseline-fallback), [Web fallback](../../internal/sdk-knowledge/web/web.md#failure--fallback-behavior), [React Web fallback](../../internal/sdk-knowledge/web/react-web.md#failure--fallback-behavior), [Node fallback](../../internal/sdk-knowledge/node/node.md#failure--fallback-behavior)        |

## Handoffs

None.

## Link roles

- [Entry personalization and variant resolution concept](../../concepts/entry-personalization-and-variant-resolution.md).
- [Web SDK integration guide](../../guides/integrating-the-web-sdk-in-a-web-app.md).
- [React Web integration guide](../../guides/integrating-the-react-web-sdk-in-a-react-app.md).
- [Node SDK integration guide](../../guides/integrating-the-node-sdk-in-a-node-app.md).
- [Contentful personalization authoring](https://www.contentful.com/developers/docs/personalization/).
