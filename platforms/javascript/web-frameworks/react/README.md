<p align="center">
  <a href="https://www.contentful.com/developers/docs/personalization/">
    <img alt="Contentful Logo" title="Contentful" src="../../../../contentful-icon.png" width="150">
  </a>
</p>

<h1 align="center">Contentful Personalization & Analytics</h1>

<h3 align="center">Optimization React Web SDK</h3>

## Overview

The React Web SDK provides React-native integration primitives on top of
`@contentful/optimization-web`, including provider setup, hooks, and helper components for common
application flows.

## Installation

```sh
pnpm add @contentful/optimization-react-web react react-dom
```

## Usage

```tsx
import React from 'react'
import { OptimizationProvider, useOptimization } from '@contentful/optimization-react-web'

function Feature(): React.JSX.Element {
  const optimization = useOptimization()

  return <>{String(Boolean(optimization))}</>
}

export function App(): React.JSX.Element {
  return (
    <OptimizationProvider config={{ clientId: 'key_123', environment: 'main' }}>
      <Feature />
    </OptimizationProvider>
  )
}
```

## Migration Guidance

- Supported migration mode is full replacement of direct `@contentful/optimization-web` usage.
- Mixed direct Web SDK + React SDK integration is not a supported steady-state mode.
- Capability parity is tracked via `src/contracts/capabilityMapping.ts`.

## Dependency Policy

- Runtime dependency additions are capped to one new dependency unless an exception is approved.
- Document approved exceptions in release notes and PR rationale.

## Observability Guidance

- Standardized logs and metrics guidance must be documented for release readiness checks.
- Tracing is optional for initial release.

## Testing Guidance

- Use MSW handler helpers exported by the `mocks` workspace package for API behavior simulation.
- Do not import MSW handlers directly from internal source-file paths.

## Scripts

- `pnpm --filter @contentful/optimization-react-web build`
- `pnpm --filter @contentful/optimization-react-web typecheck`
- `pnpm --filter @contentful/optimization-react-web test:unit`
- `pnpm --filter @contentful/optimization-react-web validate`
