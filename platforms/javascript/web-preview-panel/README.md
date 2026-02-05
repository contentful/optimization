<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Optimization Web Preview Panel</h3>

<div align="center">

[Readme](./README.md) · [Reference](https://contentful.github.io/optimization) ·
[Contributing](/CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is currently ALPHA! Breaking changes may be published at any time.

This library implements a "preview panel" compatible with the
[Contentful Optimization Web SDK](../web/README.md). The preview panel is loaded into the DOM as a
Web Component-based micro-frontend.

> [!INFO]
>
> The Contentful Optimization Web Preview Panel is built using the Lit framework for Web Component
> micro-frontends

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Getting Started](#getting-started)
- [Content Security Policy Support](#content-security-policy-support)

<!-- mtoc-end -->
</details>

## Getting Started

Install using an NPM-compatible package manager, pnpm for example:

```sh
pnpm install @contentful/optimization-web-preview-panel
```

Import the Optimization class; both CJS and ESM module systems are supported, ESM preferred:

```ts
import attachOptimizationPreviewPanel from '@contentful/optimization-web-preview-panel'
```

Initialize the preview panel with existing instances of the Contentful SDK and the Optimization Web
SDK:

```ts
attachOptimizationPreviewPanel(contentfulClient, optimization)
```

The `attachOptimizationPreviewPanel` function automatically attaches itself to the DOM and adds the
toggle button with which the panel can be opened.

## Content Security Policy Support

In order to comply with strict CSP policies, a nonce can be supplied to the
`attachOptimizationPreviewPanel` function as its third argument.

```ts
attachOptimizationPreviewPanel(contentfulClient, optimization, nonce)
```

Alternatively, the nonce can be added to the `window` _before_ attaching the preview panel to the
DOM.

```ts
window.litNonce = nonce
attachOptimizationPreviewPanel(contentfulClient, optimization)
```
