<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">API Schema Library</h3>

<div align="center">

[Readme](./README.md) · [Reference](https://contentful.github.io/optimization) ·
[Contributing](/CONTRIBUTING.md)

</div>

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
SDK are valid for personalization. These schemas do not encapsulate all features and functionality
specified in the CDA SDK's exported TypeScript type system, but strive to remain compatible enough
for the purposes of personalization.

### Essential Schemas

- `CtflEntry`: Zod schema describing a generic Contentful entry; the `fields` member is loosely
  typed as any valid JSON
- `PersonalizedEntry`: Zod schema describing a `CtflEntry` that has associated personalization
  entries
- `PersonalizationEntry`: Zod schema describing a personalization entry, which is associated with a
  `PersonalizedEntry` via its `fields.nt_experiences` property
- `PersonalizationConfig`: Zod schema describing the configuration of a `PersonalizationEntry` via
  its `fields.nt_config` property

### Essential Functions

- `isEntry<S extends SkeletonType, M extends ChainModifiers, L extends string>`: Type guard that
  checks whether the given value is a Contentful Entry, passing through the specified skeleton,
  chain modifiers, and locale
- `isPersonalizedEntry`: Type guard for `PersonalizedEntry`
- `isPersonalizationEntry`: Type guard for `PersonalizationEntry`

## Experience API Schemas

These schemas help validate at run-time that both the request and response data for Experience API
requests conform to current API specifications.

### Essential Experience API Request Schemas

- `ExperienceRequestData`: Zod schema describing the data payload for an experience request
- `ExperienceEvent`: Zod schema union of supported experience/personalization events
- `BatchExperienceEvent`: Zod schema describing each valid experience/personalization event within a
  batch; Similar to `ExperienceEvent`, but with an additional `anonymousId` member on each event
  schema

Experience/personalization event schemas:

- `AliasEvent`: Zod schema describing an `alias` event
- `ComponentViewEvent`: Zod schema describing a `component` view event (may be a Contentful entry or
  a Custom Flag)
- `IdentifyEvent`: Zod schema describing an `identify` event
- `PageViewEvent`: Zod schema describing a `page` view event
- `ScreenViewEvent`: Zod schema describing a `screen` view event
- `TrackEvent`: Zod schema describing a custom `track` event

### Essential Experience API Response Schemas

- `ExperienceResponse`: Zod schema describing a full Experience API response; includes a `data`
  object with `changes`, `experiences`, and `profile` properties
- `BatchExperienceResponse`: Zod schema describing a batch experience response from the Experience
  API; includes a `profiles` collection
- `Change`: Union of supported change types, which currently only includes `VariableChange`; this
  change type is used for Custom Flags
- `SelectedPersonalization`: Zod schema describing a selected personalization outcome for a user
- `Profile`: Zod schema describing a full user profile as received from the Experience API

## Insights API Schemas

Insights API endpoints currently do not return response data.

### Essential Insights API Response Schemas

- `InsightsEvent`: Zod schema union of supported insights/analytics events
- `BatchInsightsEvent`: Zod schema describing a batched Insights event payload; expects a `profile`
  property alongside a collection of `events`

Insights/analytics event schemas:

- `ComponentViewEvent`: Zod schema describing a `component` view event (may be a Contentful entry or
  a Custom Flag)
