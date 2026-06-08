<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Angular Web SDK Reference Implementation</h3>

<div align="center">

[Readme](./README.md) ·
[Guides](https://contentful.github.io/optimization/documents/Documentation.Guides.html) ·
[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)

</div>

> [!WARNING]
>
> The Optimization SDK Suite is pre-release (alpha). Breaking changes can be published at any time.

Reference implementation skeleton for Angular Web applications. Currently serves a Hello World page
and establishes the project structure for future `@contentful/optimization-web` integration.

## What this demonstrates

This is a scaffold. SDK integration will be added once the Angular surface is ready.

## Prerequisites

- Node.js >= 20.19.0 (24.13.0 recommended to match `.nvmrc`)
- pnpm 10.x

## Quick start

```sh
./implementations/angular-web-sdk/scripts/launch-reference-app.sh
```

Or from the **implementation directory**:

```sh
pnpm launch
```

Once complete, the app is available at `http://localhost:3000`.

## Manual setup

From the **repository root**:

```sh
pnpm build:pkgs
pnpm implementation:run -- angular-web-sdk implementation:install
```

## Running locally

From the **repository root**:

```sh
pnpm implementation:run -- angular-web-sdk dev
pnpm implementation:run -- angular-web-sdk build
pnpm implementation:run -- angular-web-sdk typecheck
```

Or from the **implementation directory**:

```sh
pnpm dev
pnpm build
pnpm typecheck
```

## Environment variables

Copy `.env.example` to `.env`:

```sh
cp .env.example .env
```

## Project structure

```
angular-web-sdk/
├── src/
│   ├── main.ts               # Application bootstrap
│   ├── index.html            # HTML shell
│   ├── styles.css            # Global styles
│   └── app/
│       ├── app.ts            # Root standalone component
│       ├── app.config.ts     # Application providers
│       └── app.routes.ts     # Route definitions
├── angular.json              # Angular CLI build config
├── tsconfig.json
├── .env.example
├── package.json
├── pnpm-workspace.yaml
├── scripts/
│   └── launch-reference-app.sh
├── AGENTS.md
└── README.md
```

## Related

- [react-web-sdk](../react-web-sdk/README.md) - React Web SDK reference implementation
- [web-sdk](../web-sdk/README.md) - vanilla JavaScript reference
- [@contentful/optimization-web](../../packages/web/web-sdk/README.md) - Web SDK
