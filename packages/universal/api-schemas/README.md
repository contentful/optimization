<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">API Schema Library</h3>

<div align="center">

[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes may be published at any time.

The Contentful Optimization API Schema Library provides Zod Mini schemas, inferred TypeScript types,
and small runtime helpers for Contentful CDA, Experience API, and Insights API payloads. SDK layers
use this package to validate API contracts and normalize optimization data.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Getting Started](#getting-started)
- [When to Use This Package](#when-to-use-this-package)
- [Package Surface](#package-surface)
  - [Contentful CDA Helpers](#contentful-cda-helpers)
  - [Experience API Schemas](#experience-api-schemas)
  - [Insights API Schemas](#insights-api-schemas)
- [Related](#related)

<!-- mtoc-end -->
</details>

## Getting Started

Install using an NPM-compatible package manager, pnpm for example:

```sh
pnpm install @contentful/optimization-api-schemas
```

Import schemas or helpers from the package:

```ts
import { isOptimizedEntry, normalizeOptimizationConfig } from '@contentful/optimization-api-schemas'
```

Consult [Zod's documentation](https://zod.dev/basics) for more information on working with
[Zod Mini](https://zod.dev/packages/mini) schemas.

## When to Use This Package

Use `@contentful/optimization-api-schemas` when you need shared runtime validation schemas or
inferred TypeScript types for Contentful CDA, Experience API, and Insights API payloads. Most
application integrations should use an environment SDK instead of importing schemas directly.

## Package Surface

### Contentful CDA Helpers

These helpers identify and normalize Contentful entries for optimization:

| Export                        | Purpose                                                         |
| ----------------------------- | --------------------------------------------------------------- |
| `CtflEntry`                   | Generic Contentful entry schema                                 |
| `OptimizedEntry`              | Entry schema with associated optimization entries               |
| `OptimizationEntry`           | Optimization entry schema referenced by `fields.nt_experiences` |
| `OptimizationConfig`          | Optimization configuration schema from `fields.nt_config`       |
| `isEntry`                     | Type guard for Contentful Entry values                          |
| `isOptimizedEntry`            | Type guard for optimized entries                                |
| `isOptimizationEntry`         | Type guard for optimization entries                             |
| `normalizeOptimizationConfig` | Fills omitted optimization config fields with SDK-safe defaults |

### Experience API Schemas

Experience API schemas validate profile evaluation request and response payloads:

| Export                       | Purpose                                                      |
| ---------------------------- | ------------------------------------------------------------ |
| `ExperienceRequestData`      | Request payload for a single Experience API call             |
| `BatchExperienceRequestData` | Request payload for batch Experience API calls               |
| `ExperienceEvent`            | Union of supported Experience API event schemas              |
| `BatchExperienceEvent`       | Batch event schema with required `anonymousId` per event     |
| `ExperienceResponse`         | Full Experience API response envelope                        |
| `BatchExperienceResponse`    | Batch Experience API response envelope                       |
| `Change`                     | Supported change union, currently including Custom Flag data |
| `SelectedOptimization`       | Selected optimization outcome for a profile                  |
| `Profile`                    | User profile returned by the Experience API                  |

### Insights API Schemas

Insights API schemas validate event ingestion payloads:

| Export               | Purpose                                                     |
| -------------------- | ----------------------------------------------------------- |
| `InsightsEvent`      | Union of supported Insights API event schemas               |
| `BatchInsightsEvent` | Batched Insights API payload with profile and event entries |
| `ClickEvent`         | `component_click` event schema                              |
| `HoverEvent`         | `component_hover` event schema                              |
| `ViewEvent`          | `component` view event schema                               |

For every schema, inferred type, and helper signature, use the generated
[API Schemas reference](https://contentful.github.io/optimization/modules/_contentful_optimization-api-schemas.html).

## Related

- [API Schemas generated reference](https://contentful.github.io/optimization/modules/_contentful_optimization-api-schemas.html) -
  exported schema and type reference
- [API Client](../api-client/README.md) - low-level Experience API and Insights API transport
- [Optimization Core SDK](../core-sdk/README.md) - platform-agnostic SDK layer that consumes these
  schemas
- [Choosing the Right SDK](https://contentful.github.io/optimization/documents/Documentation.Guides.choosing-the-right-sdk.html) -
  package selection guidance for application integrations
