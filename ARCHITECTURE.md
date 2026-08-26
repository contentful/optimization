# Architecture

## Purpose

Public pnpm monorepo for Contentful Personalization and Analytics SDKs across web, Node.js, React Native, iOS, and Android.

## Main areas

- packages/ contains published SDKs and shared libraries.
- implementations/ contains reference applications and end-to-end fixtures.
- lib/ contains shared development, mock, and test tooling.
- documentation/ contains guides and concepts; scripts/ contains release and validation tooling.

## Change flow

Repository manifests and checked-in configuration define how source becomes a build, package, report, example, or documentation artifact. Keep changes inside the owning area and follow explicit dependencies rather than copying behavior between components.

## Boundaries

External services, credentials, and deployment environments are not represented by source code alone. Local validation should use documented fixtures or configuration and must not embed secrets.

## Failure and verification

Start with the narrowest affected command, inspect its direct inputs, and expand to repository-level validation. If a required external system is unavailable, record that verification gap instead of claiming success.
