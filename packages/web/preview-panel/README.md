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

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes can be published at any time.

This package implements the first-party browser preview panel for the
[Optimization Web SDK](../web-sdk/README.md). It loads into the DOM as a Lit-based Web Component
micro-frontend and talks to the Web SDK through the preview bridge exposed by
`optimization.registerPreviewPanel(...)`.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Getting started](#getting-started)
- [When to use this package](#when-to-use-this-package)
- [Common configuration](#common-configuration)
- [Content security policy support](#content-security-policy-support)
- [Related](#related)

<!-- mtoc-end -->
</details>

## Getting started

Install using an NPM-compatible package manager, pnpm for example:

```sh
pnpm install @contentful/optimization-web-preview-panel
```

Import the attach function; both CJS and ESM module systems are supported, ESM preferred:

```ts
import attachOptimizationPreviewPanel from '@contentful/optimization-web-preview-panel'
```

Attach the preview panel with existing Contentful SDK and Optimization Web SDK instances:

```ts
attachOptimizationPreviewPanel({
  contentful: contentfulClient,
  optimization,
})
```

The attach function appends the panel to the DOM and adds the toggle button that opens it.

> [!IMPORTANT]
>
> The preview panel is intentionally coupled to Optimization Web SDK internals. It uses the
> symbol-keyed preview bridge and state interceptors to read and mutate local preview state. This is
> a first-party preview surface, not a general extension API.

## When to use this package

Use `@contentful/optimization-web-preview-panel` when a Web SDK or React Web SDK integration needs
the browser preview panel attached to an existing Contentful SDK client and Optimization Web SDK
instance. Application code must not use this package as a general state extension point.

## Common configuration

| Option         | Required? | Default     | Description                                                |
| -------------- | --------- | ----------- | ---------------------------------------------------------- |
| `contentful`   | Yes       | N/A         | Existing Contentful client used to read preview content    |
| `optimization` | Yes       | N/A         | Existing Optimization Web SDK instance                     |
| `nonce`        | No        | `undefined` | CSP nonce applied to Lit styles when strict CSP is enabled |

For the complete attach function signature, use the generated
[Preview Panel reference](https://contentful.github.io/optimization/modules/_contentful_optimization-web-preview-panel.html).

## Content security policy support

In strict CSP environments, pass a nonce directly:

```ts
attachOptimizationPreviewPanel({ contentful: contentfulClient, optimization, nonce })
```

Alternatively, set `window.litNonce` before attaching the panel:

```ts
window.litNonce = nonce
attachOptimizationPreviewPanel({ contentful: contentfulClient, optimization })
```

## Related

- [Preview Panel generated reference](https://contentful.github.io/optimization/modules/_contentful_optimization-web-preview-panel.html) -
  exported attach function reference
- [Optimization Web SDK](../web-sdk/README.md) - browser SDK that provides the preview bridge
- [Optimization React Web SDK](../frameworks/react-web-sdk/README.md) - React layer commonly used
  with the preview panel
- [React Web integration guide](https://contentful.github.io/optimization/documents/Documentation.Guides.integrating-the-react-web-sdk-in-a-react-app.html#preview-panel) -
  preview setup in a React application
