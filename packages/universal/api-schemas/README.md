<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">API Schema Library</h3>

<div align="center">

[Readme](./README.md) · [Reference](https://contentful.github.io/optimization) ·
[Contributing](../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes may be published at any time.

The Contentful Optimization API Schema Library is a collection of Zod Mini schemas and their
inferred TypeScript types. These schemas help provide run-time validation when working with requests
and responses for the APIs referenced within Optimization SDKs.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Getting Started](#getting-started)
- [Contentful CDA Schemas](#contentful-cda-schemas)
  - [Essential Schemas](#essential-schemas)
  - [Essential Functions](#essential-functions)
- [Experience API Schemas](#experience-api-schemas)
  - [Essential Experience API Request Schemas](#essential-experience-api-request-schemas)
  - [Essential Experience API Response Schemas](#essential-experience-api-response-schemas)
- [Insights API Schemas](#insights-api-schemas)
  - [Essential Insights API Response Schemas](#essential-insights-api-response-schemas)

<!-- mtoc-end -->
</details>

## Getting Started

Install using an NPM-compatible package manager, pnpm for example:

```sh
pnpm install @contentful/optimization-api-schemas
```

Consult [Zod's documentation](https://zod.dev/basics) for more information on working with
[Zod Mini](https://zod.dev/packages/mini) schemas.

## Contentful CDA Schemas

These schemas assist in determining whether Contentful content entries provided by the CDA and its
SDK are valid for optimization. These schemas do not encapsulate all features and functionality
specified in the CDA SDK's exported TypeScript type system, but strive to remain compatible enough
for the purposes of optimization.

### Essential Schemas

- `CtflEntry`: Zod schema describing a generic Contentful entry; the `fields` member is loosely
  typed as any valid JSON
- `OptimizedEntry`: Zod schema describing a `CtflEntry` that has associated optimization entries
- `OptimizationEntry`: Zod schema describing an optimization entry, which is associated with an
  `OptimizedEntry` via its `fields.nt_experiences` property
- `OptimizationConfig`: Zod schema describing the configuration of an `OptimizationEntry` via its
  `fields.nt_config` property

### Essential Functions

- `isEntry<S extends SkeletonType, M extends ChainModifiers, L extends string>`: Type guard that
  checks whether the given value is a Contentful Entry, passing through the specified skeleton,
  chain modifiers, and locale
- `isOptimizedEntry`: Type guard for `OptimizedEntry`
- `isOptimizationEntry`: Type guard for `OptimizationEntry`
- `normalizeOptimizationConfig`: Runtime helper that fills omitted `OptimizationConfig` fields with
  SDK-safe defaults

## Experience API Schemas

These schemas help validate at run-time that both the request and response data for Experience API
requests conform to current API specifications.

### Essential Experience API Request Schemas

- `ExperienceRequestData`: Zod schema describing the data payload for an Experience API request
- `BatchExperienceRequestData`: Zod schema describing the data payload for a batch Experience API
  request; requires at least one batch event
- `ExperienceEvent`: Zod schema union of supported Experience API events
- `BatchExperienceEvent`: Zod schema describing each valid Experience API event within a batch;
  Similar to `ExperienceEvent`, but with an additional `anonymousId` member on each event schema

Experience API event schemas:

- `AliasEvent`: Zod schema describing an `alias` event
- `ViewEvent`: Zod schema describing a `component` view event used for entry and Custom Flag
  exposure tracking
- `GroupEvent`: Zod schema describing a `group` event
- `IdentifyEvent`: Zod schema describing an `identify` event
- `PageViewEvent`: Zod schema describing a `page` view event
- `ScreenViewEvent`: Zod schema describing a `screen` view event
- `TrackEvent`: Zod schema describing a custom `track` event

### Essential Experience API Response Schemas

- `ExperienceResponse`: Zod schema describing a full Experience API response; includes a `data`
  object with `changes`, `experiences`, and `profile` properties
- `BatchExperienceResponse`: Zod schema describing a batch Experience API response; includes a
  `data` payload described by `BatchExperienceResponseData`
- `BatchExperienceResponseData`: Zod schema describing the `data` payload for
  `BatchExperienceResponse`
- `Change`: Union of supported change types, which currently only includes `VariableChange`; this
  change type is used for Custom Flags
- `SelectedOptimization`: Zod schema describing a selected optimization outcome for a user
- `Profile`: Zod schema describing a full user profile as received from the Experience API

## Insights API Schemas

Insights API endpoints currently do not return response data.

### Essential Insights API Response Schemas

- `InsightsEvent`: Zod schema union of supported Insights API events
- `BatchInsightsEvent`: Zod schema describing a batched Insights API event payload; expects a
  `profile` property alongside a collection of `events`

Insights API event schemas:

- `ClickEvent`: Zod schema describing a `component_click` event used for entry click tracking
- `HoverEvent`: Zod schema describing a `component_hover` event used for entry hover tracking
- `ViewEvent`: Zod schema describing a `component` view event used for entry and Custom Flag
  exposure tracking
