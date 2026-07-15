<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Optimization Web Preview Panel</h3>

<div align="center">

[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../../CONTRIBUTING.md)

</div>

This package implements the first-party browser preview panel for the
[Optimization Web SDK](../web-sdk/README.md). It loads into the DOM as a Lit-based Web Component
micro-frontend and talks to the Web SDK through the preview bridge exposed by the Optimization Web
SDK runtime.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Getting started](#getting-started)
- [When to use this package](#when-to-use-this-package)
- [Pre-fetched entries](#pre-fetched-entries)
- [Common configuration](#common-configuration)
- [Production bundle control](#production-bundle-control)
- [Content security policy support](#content-security-policy-support)
- [Related](#related)

<!-- mtoc-end -->
</details>

## Getting started

Install using an NPM-compatible package manager, pnpm for example:

```sh
pnpm add @contentful/optimization-web-preview-panel
```

Import the attach function; both CJS and ESM module systems are supported, ESM preferred:

```ts
import attachOptimizationPreviewPanel from '@contentful/optimization-web-preview-panel'
```

Attach the preview panel with an existing, unmodified Contentful Delivery API client. By default,
the attach function uses the browser singleton created by the Optimization Web SDK:

```ts
attachOptimizationPreviewPanel({
  contentful: contentfulClient,
})
```

When your application already fetches preview content, pass `entries` instead:

```ts
attachOptimizationPreviewPanel({
  entries: {
    audiences: audienceEntries,
    experiences: experienceEntries,
  },
})
```

The attach function appends the panel to the DOM and adds the toggle button that opens it. It is
safe to call more than once; repeated calls reuse the in-flight or completed panel attachment. The
panel search uses fuzzy matching for audience and optimization names and highlights matched text in
the result list.

> [!IMPORTANT]
>
> Importing this package has no side effects. It does not attach the panel, define custom elements,
> inject styles, touch storage, or mutate globals until `attachOptimizationPreviewPanel(...)` is
> called.

## When to use this package

Use `@contentful/optimization-web-preview-panel` when a Web SDK or React Web SDK integration needs
the browser preview panel attached to an existing Contentful SDK client. Application code can pass
an explicit Optimization Web SDK instance, but the common browser flow uses
`window.contentfulOptimization`.

## Pre-fetched entries

Use `entries` when the app cannot give the browser preview panel a direct Contentful client or when
it already owns the query layer. This covers GraphQL query adapters, Hydrogen loaders, SSR data
handoff, tag-filtered Contentful queries, and proxy APIs.

The `entries` option has this shape:

```ts
attachOptimizationPreviewPanel({
  entries: {
    audiences,
    experiences,
  },
})
```

Each value can be either a Contentful-style entry collection or a readonly array of Contentful
entries. The preview panel normalizes arrays into entry collections, keeps only `nt_audience` items
from `audiences`, keeps only `nt_experience` items from `experiences`, and preserves
`experiences.includes.Entry` so linked variant names can be displayed.

If both `entries` and `contentful` are provided, `entries` wins and the preview panel does not fetch
through the Contentful client.

Common paths:

- **Contentful client** - Pass `contentful` first when the browser can use an existing Contentful
  Delivery API client.
- **GraphQL** - Map GraphQL nodes to Contentful entry objects, then pass the arrays as
  `entries.audiences` and `entries.experiences`.
- **Hydrogen loaders and SSR** - Load audiences and experiences in the loader or server route,
  serialize them to the browser, then attach with `entries`.
- **Tag-filtered queries** - Pass the filtered Contentful collections directly. The panel still
  filters by content type before building definitions.
- **Proxy APIs** - Return `{ audiences, experiences }` from the proxy and pass that object as
  `entries`.

## Common configuration

| Option         | Required?   | Default                         | Description                                                |
| -------------- | ----------- | ------------------------------- | ---------------------------------------------------------- |
| `contentful`   | Conditional | N/A                             | Existing Contentful client used to read preview content    |
| `entries`      | Conditional | N/A                             | Pre-fetched audience and experience entries                |
| `optimization` | No          | `window.contentfulOptimization` | Existing Optimization Web SDK instance                     |
| `nonce`        | No          | `undefined`                     | CSP nonce applied to Lit styles when strict CSP is enabled |

Provide either `contentful` or `entries`.

For the complete attach function signature, use the generated
[Preview Panel reference](https://contentful.github.io/optimization/modules/_contentful_optimization-web-preview-panel.html).

## Production bundle control

The preview panel is intended for development and staging builds. Consumers own that build policy
and can wrap the attachment call in an environment-backed conditional:

```ts
import attachOptimizationPreviewPanel from '@contentful/optimization-web-preview-panel'

if (import.meta.env.PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL === 'true') {
  void attachOptimizationPreviewPanel({ contentful: contentfulClient })
}
```

When the consumer bundler replaces that condition with a build-time `false` value and performs
dead-code elimination, the side-effect-free preview panel import graph can be removed from the
production output.

## Content security policy support

In strict CSP environments, pass a nonce directly:

```ts
attachOptimizationPreviewPanel({ contentful: contentfulClient, nonce })
```

Alternatively, set `window.litNonce` before attaching the panel:

```ts
window.litNonce = nonce
attachOptimizationPreviewPanel({ contentful: contentfulClient })
```

## Related

- [Preview Panel generated reference](https://contentful.github.io/optimization/modules/_contentful_optimization-web-preview-panel.html) -
  exported attach function reference
- [Optimization Web SDK](../web-sdk/README.md) - browser SDK that provides the preview bridge
- [Optimization React Web SDK](../frameworks/react-web-sdk/README.md) - React layer commonly used
  with the preview panel
- [React Web integration guide](https://contentful.github.io/optimization/documents/Documentation.Guides.integrating-the-react-web-sdk-in-a-react-app.html#preview-panel) -
  preview setup in a React application
