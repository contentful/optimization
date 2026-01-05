<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="./contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Contributing</h3>

<div align="center">

[Readme](./README.md) · [Reference](https://contentful.github.io/optimization) ·
[Contributing](./CONTRIBUTING.md)

</div>

We appreciate any community contributions to this project, whether in the form of issues or pull
requests.

This document outlines what we'd like you to follow in terms of commit messages and code style.

It also explains what to do in case you want to set up the project locally and run tests.

**Working on your first Pull Request?** You can learn how from this extensive
[list of resources for people who are new to contributing to Open Source](https://github.com/freeCodeCamp/how-to-contribute-to-open-source).

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Setup](#setup)
- [Useful Scripts](#useful-scripts)
- [Code Style](#code-style)
- [Documentation](#documentation)
- [Troubleshooting CI Issues](#troubleshooting-ci-issues)
  - [License Check Failure](#license-check-failure)

<!-- mtoc-end -->
</details>

## Setup

The following software is required for testing and maintaining Optimization SDK Suite packages:

- [pnpm](https://pnpm.io/installation)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or any Docker-compatible
  container manager

> [!NOTE]
>
> Docker is currently only used to run E2E tests, specifically for the Web Vanilla reference
> implementation

## Useful Scripts

Code formatting:

```sh
pnpm format:check
pnpm format:fix
```

Code linting:

```sh
pnpm lint:check
pnpm link:fix
```

Check types:

```sh
pnpm typecheck
```

Build all packages:

```sh
pnpm build
```

Run unit tests:

```sh
pnpm test:unit
```

Run E2E tests:

```sh
pnpm test:e2e
```

Manage processes (useful when running reference implementations and their E2E tests):

```sh
pnpm pm2:list
pnpm pm2:logs
pnpm pm2:stop:all
pnpm pm2:delete:all
```

Clean up all build artifacts:

```sh
pnpm clean
```

Run any command for a specific package (example):

```sh
pnpm --filter @contentful/optimization-web dev
```

## Code Style

This project uses [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/) to enforce
coding and formatting conventions. It may be useful to enable related editor plugins to have a
smoother experience when working on Optimization SDKs.

Please review the following files to familiarize yourself with current configurations:

- [eslint.config.ts](./eslint.config.ts)
- [.prettierrc](./.prettierrc)
- [.markdownlint.yaml](./.markdownlint.yaml)

## Documentation

Code is documented using TSDoc, and reference documentation is generated using TypeDoc and published
automatically with each new version.

- `pnpm docs:generate` generates documentation from TSDoc code comments, as well as README and other
  linked markdown files
- `pnpm docs:watch` watches for file updates and rebuilds documentation output; useful while writing
  and updating documentation

## Troubleshooting CI Issues

### License Check Failure

Run `licence-check` locally:

```sh
pnpx license-check --summary
pnpx license-check > licenses.txt
```

If the license for a package merely has a spelling or formatting difference from an existing entry
in the `license-check` GitHub workflow allow list, update the list and submit the change via pull
request. Otherwise, create an issue to receive further guidance from the maintainers.
