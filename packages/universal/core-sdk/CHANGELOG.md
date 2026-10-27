# Changelog

## [2.2.0](https://github.com/contentful/optimization/compare/optimization-core-v2.1.1...optimization-core-v2.2.0) (2026-10-27)

### Features

- **core:** add request-bound event construction and stateless fast paths ([#564](https://github.com/contentful/optimization/issues/564)) ([7ddc83d](https://github.com/contentful/optimization/commit/7ddc83d6b6b8a0553ce0b6a86bef36f8c678d698))

### Bug Fixes

- **runtime:** isolate lifecycle state and queued event delivery ([#558](https://github.com/contentful/optimization/issues/558)) ([1ef0d12](https://github.com/contentful/optimization/commit/1ef0d12e4754a23121cdab3881302ee554f52045))

## [2.1.1](https://github.com/contentful/optimization/compare/optimization-core-v2.1.0...optimization-core-v2.1.1) (2026-10-21)

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @contentful/optimization-api-client bumped to 2.2.1

## [2.1.0](https://github.com/contentful/optimization/compare/optimization-core-v2.0.2...optimization-core-v2.1.0) (2026-10-19)

### Features

- **runtime:** support request-level location across SDKs [NT-4321] ([#552](https://github.com/contentful/optimization/issues/552)) ([9ea0ef4](https://github.com/contentful/optimization/commit/9ea0ef4d8d2d50fd8c6217834a7b2a32113bed83))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @contentful/optimization-api-client bumped to 2.2.0

## [2.0.2](https://github.com/contentful/optimization/compare/optimization-core-v2.0.1...optimization-core-v2.0.2) (2026-10-16)

### Reverts

- **runtime:** defer server preview and browser commit ([#548](https://github.com/contentful/optimization/issues/548)) ([28f12f5](https://github.com/contentful/optimization/commit/28f12f53652047b2fd6dc2526390aa8bcf2d5780))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @contentful/optimization-api-client bumped to 2.1.0

## [2.0.1](https://github.com/contentful/optimization/compare/optimization-core-v2.0.0...optimization-core-v2.0.1) (2026-09-23)

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @contentful/optimization-api-client bumped to 2.0.1

## [2.0.0](https://github.com/contentful/optimization/compare/optimization-core-v1.3.0...optimization-core-v2.0.0) (2026-09-21)

### ⚠ BREAKING CHANGES

- **api-client:** SDK configuration now requires spaceId instead of clientId and defaults environment to master instead of main. The Experience and Insights API route contracts, native SDK initialization APIs, Web Component attributes, and exported API schemas have also changed. Existing consumers must migrate before upgrading.

### Features

- **api-client:** migrate Experience API to v3 and Insights API to v2 ([fa0896c](https://github.com/contentful/optimization/commit/fa0896cc6a59138165c87120e6030e38871b9cbd))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @contentful/optimization-api-client bumped to 2.0.0

## [1.3.0](https://github.com/contentful/optimization/compare/optimization-core-v1.2.0...optimization-core-v1.3.0) (2026-08-21)

### Features

- **core:** infer campaign data from UTM parameters ([#460](https://github.com/contentful/optimization/issues/460)) ([e7b61b6](https://github.com/contentful/optimization/commit/e7b61b60a2887ee0d20a33846cd20042abc9b078))
- **runtime:** emit component interactions only at start and end [NT-3966] ([#458](https://github.com/contentful/optimization/issues/458)) ([ddca28d](https://github.com/contentful/optimization/commit/ddca28de2135f8918e4c40ba0f5d4a40c5c439d2))

## [1.2.0](https://github.com/contentful/optimization/compare/optimization-core-v1.1.0...optimization-core-v1.2.0) (2026-08-10)

### Features

- **core:** fetch managed Contentful entries by slug ([#420](https://github.com/contentful/optimization/issues/420)) ([4ce8cd5](https://github.com/contentful/optimization/commit/4ce8cd57268fefca913acf602fc21c47c3d06eee))
- **core:** support heterogeneous optimized entry types ([#413](https://github.com/contentful/optimization/issues/413)) ([2a3a9c8](https://github.com/contentful/optimization/commit/2a3a9c8d002975ebd1508e6344eb3bcccbc1a46f))

### Bug Fixes

- **core:** downgrade baseline resolution logs to debug [NT-3840] ([#407](https://github.com/contentful/optimization/issues/407)) ([ef3c543](https://github.com/contentful/optimization/commit/ef3c5434b5823312c3f66aebcac1c0dec52f11a7))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @contentful/optimization-api-client bumped to 1.1.1

## [1.1.0](https://github.com/contentful/optimization/compare/optimization-core-v1.0.1...optimization-core-v1.1.0) (2026-07-29)

### Features

- **nextjs:** add cache-safe optimization handoff support ([#379](https://github.com/contentful/optimization/issues/379)) ([a169e6d](https://github.com/contentful/optimization/commit/a169e6d993fbca309d6ab3c44642fcca423dbb58))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @contentful/optimization-api-client bumped to 1.1.0

## [1.0.1](https://github.com/contentful/optimization/compare/optimization-core-v1.0.0...optimization-core-v1.0.1) (2026-07-15)

### Bug Fixes

- **publish:** update package release status metadata ([#375](https://github.com/contentful/optimization/issues/375)) ([84a04fa](https://github.com/contentful/optimization/commit/84a04faf42e4d8b3d022be38a7b7d5f83de86b50))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @contentful/optimization-api-client bumped to 1.0.1

## [1.0.0](https://github.com/contentful/optimization/compare/optimization-core-v0.1.0-alpha18...optimization-core-v1.0.0) (2026-07-14)

### Features

- **repo:** new semantic versioning and CD process ([#363](https://github.com/contentful/optimization/issues/363)) ([031227f](https://github.com/contentful/optimization/commit/031227f5f4d463ac72acf36043ffe75a5e73a501))

### Bug Fixes

- **typedoc:** resolve doc-generation warnings ([#365](https://github.com/contentful/optimization/issues/365)) ([7189ff5](https://github.com/contentful/optimization/commit/7189ff5866f166968060a01a5948224bca2d4ef0))

### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - @contentful/optimization-api-client bumped to 1.0.0

## Changelog
