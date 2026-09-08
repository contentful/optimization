<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">API Schema Compatibility Facade</h3>

<div align="center">

[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> `@contentful/optimization-api-schemas` is deprecated. It remains available as a compatibility
> facade for the historical combined root schema surface. Do not add new imports from this package.

This package preserves the historical root exports for Contentful CDA, Experience API, and Insights
API schemas. The owning packages maintain those contracts.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Getting started](#getting-started)
- [Migrate imports](#migrate-imports)
- [Compatibility surface](#compatibility-surface)
- [Related](#related)

<!-- mtoc-end -->
</details>

## Getting started

Install using an NPM-compatible package manager, pnpm for example:

```sh
pnpm install @contentful/optimization-api-schemas
```

Existing applications can continue to import from the package root while they migrate:

```ts
import { isResolvedOptimizedEntry } from '@contentful/optimization-api-schemas'
```

## Migrate imports

Move imports according to the contract they use:

| Contract                                             | Import from                                       |
| ---------------------------------------------------- | ------------------------------------------------- |
| Experience API, Insights API, and validation schemas | `@contentful/optimization-api-client/api-schemas` |
| Contentful CDA schemas and helpers                   | `@contentful/optimization-core/api-schemas`       |

For example, replace a combined historical import with owner-specific imports:

```ts
import { ExperienceResponse } from '@contentful/optimization-api-client/api-schemas'
import { isResolvedOptimizedEntry } from '@contentful/optimization-core/api-schemas'
```

Most application integrations must use an environment SDK instead of importing schemas directly.
Use these imports when building or maintaining SDK layers, tooling, or tests.

## Compatibility surface

The facade preserves the same combined root surface so existing imports continue to resolve. It does
not provide new schema entry points. `@contentful/optimization-core/api-schemas` remains the
aggregate entry point for SDK layers that need CDA schemas with the API schema pass-throughs.

Consult [Zod's documentation](https://zod.dev/basics) for more information on working with
[Zod Mini](https://zod.dev/packages/mini) schemas.

## Related

- [API Client](../api-client/README.md) - low-level Experience API and Insights API transport and
  schema ownership
- [Optimization Core SDK](../core-sdk/README.md) - platform-agnostic SDK layer and CDA schema
  ownership
- [Choosing the right SDK](https://contentful.github.io/optimization/documents/Documentation.Guides.choosing-the-right-sdk.html) -
  package selection guidance for application integrations
