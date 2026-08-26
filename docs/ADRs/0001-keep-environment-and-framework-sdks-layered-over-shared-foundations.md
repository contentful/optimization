# Keep environment and framework SDKs layered over shared foundations

- Status: Accepted
- Scope: Optimization SDK Suite

## Context

The repository publishes multiple runtime and framework packages while sharing schemas, API clients, and optimization behavior.

## Decision

Keep shared behavior in universal foundation packages and expose environment or framework-specific packages as the primary application entry points.

## Consequences

Changes to shared packages can affect several SDKs, so package builds, unit tests, and relevant reference implementations must be checked together.

