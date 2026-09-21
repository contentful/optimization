# Optimization SDK v1 migration knowledge

Source revisions: the final v1 tags for each package listed in [Package baselines](#package-baselines).

Internal migration reference. Facts only; not guide prose. Source pointers use
`<package-tag>:<path>#<symbol>`.

## Package baselines

| Package                                      | Final v1 release | Source tag                              |
| -------------------------------------------- | ---------------- | --------------------------------------- |
| `com.contentful.java:optimization-android`   | `1.1.0`          | `optimization-android-v1.1.0`           |
| `ContentfulOptimization`                     | `1.1.0`          | `optimization-swift-v1.1.0`             |
| `@contentful/optimization-api-client`        | `1.1.1`          | `optimization-api-client-v1.1.1`        |
| `@contentful/optimization-core`              | `1.3.0`          | `optimization-core-v1.3.0`              |
| `@contentful/optimization-nextjs`            | `1.3.0`          | `optimization-nextjs-v1.3.0`            |
| `@contentful/optimization-node`              | `1.2.1`          | `optimization-node-v1.2.1`              |
| `@contentful/optimization-react-native`      | `1.1.0`          | `optimization-react-native-v1.1.0`      |
| `@contentful/optimization-react-web`         | `1.3.0`          | `optimization-react-web-v1.3.0`         |
| `@contentful/optimization-web`               | `1.3.0`          | `optimization-web-v1.3.0`               |
| `@contentful/optimization-web-preview-panel` | `1.2.0`          | `optimization-web-preview-panel-v1.2.0` |
| `@contentful/optimization-api-schemas`       | `1.2.0`          | `optimization-api-schemas-v1.2.0`       |

The v1 API Schemas library has its own version line and exposes Contentful CDA, Experience API, and
Insights API schemas from its package root. source:
optimization-api-schemas-v1.2.0:packages/universal/api-schemas/package.json#name;
optimization-api-schemas-v1.2.0:packages/universal/api-schemas/README.md#Package-surface.

## Shared configuration

- JavaScript SDK configuration requires `clientId`; an omitted `environment` resolves to `main`.
  The same values configure Experience and Insights API clients. source:
  optimization-api-client-v1.1.1:packages/universal/api-client/src/ApiClientBase.ts#ApiConfig;
  optimization-api-client-v1.1.1:packages/universal/api-client/src/ApiClientBase.ts#DEFAULT_ENVIRONMENT;
  optimization-core-v1.3.0:packages/universal/core-sdk/src/CoreBase.ts#CoreConfig.
- The Web, React Web, Next.js, Node, and React Native SDKs expose the shared Core configuration, so
  their v1 initialization paths inherit `clientId` and the `main` environment default. source:
  optimization-web-v1.3.0:packages/web/web-sdk/src/ContentfulOptimization.ts#ContentfulOptimization;
  optimization-react-web-v1.3.0:packages/web/frameworks/react-web-sdk/src/root/OptimizationRoot.tsx#OptimizationRootProps;
  optimization-nextjs-v1.3.0:packages/web/frameworks/nextjs-sdk/src/bound-component-types.ts#NextjsBoundRootConfig;
  optimization-node-v1.2.1:packages/node/node-sdk/src/ContentfulOptimization.ts#ContentfulOptimization;
  optimization-react-native-v1.1.0:packages/react-native-sdk/src/ContentfulOptimization.ts#ContentfulOptimization.

## API routes

- The Experience API client sends profile and event requests beneath
  `v2/organizations/{clientId}/environments/{environment}`. source:
  optimization-api-client-v1.1.1:packages/universal/api-client/src/experience/ExperienceApiClient.ts#ExperienceApiClient.
- The Insights API client sends event batches to
  `v1/organizations/{clientId}/environments/{environment}/events`. source:
  optimization-api-client-v1.1.1:packages/universal/api-client/src/insights/InsightsApiClient.ts#InsightsApiClient.

Applications using an environment or framework SDK do not construct these paths. Direct API Client
consumers, network allow-lists, proxies, and request mocks may depend on them. source:
optimization-api-client-v1.1.1:packages/universal/api-client/src/ApiClient.ts#ApiClient;
optimization-core-v1.3.0:packages/universal/core-sdk/src/CoreBase.ts#CoreBase.

## Web Component configuration

The v1 `<ctfl-optimization-root>` element observes `client-id`, reads it through the `clientId`
property, and refuses to create its owned SDK when the attribute or an assigned `sdk` is absent.
source:
optimization-web-v1.3.0:packages/web/web-sdk/src/web-components/ContentfulOptimizationRootElement.ts#ContentfulOptimizationRootElement.

## Native initialization

- Swift `OptimizationConfig` requires `clientId` and defaults `environment` to `main`; bridge
  serialization forwards those keys to the shared runtime. source:
  optimization-swift-v1.1.0:packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationConfig.swift#OptimizationConfig.
- Kotlin `OptimizationConfig` requires `clientId` and defaults `environment` to `main`; JSON
  serialization forwards those keys to the shared runtime. source:
  optimization-android-v1.1.0:packages/android/ContentfulOptimization/src/main/kotlin/com/contentful/optimization/core/OptimizationConfig.kt#OptimizationConfig.

## Response and event schemas

- The v1 Experience response envelope represents `error` as a nullable boolean. source:
  optimization-api-schemas-v1.2.0:packages/universal/api-schemas/src/experience/ResponseEnvelope.ts#ResponseEnvelope.
- The v1 `Change` union accepts only `Variable` changes. source:
  optimization-api-schemas-v1.2.0:packages/universal/api-schemas/src/experience/change/Change.ts#Change.
- The v1 Experience event union includes `alias` and `group`; the Insights event union includes
  `component`, `component_click`, and `component_hover`. source:
  optimization-api-schemas-v1.2.0:packages/universal/api-schemas/src/experience/event/ExperienceEvent.ts#ExperienceEvent;
  optimization-api-schemas-v1.2.0:packages/universal/api-schemas/src/insights/event/InsightsEvent.ts#InsightsEvent.

## V1 integration boundaries

- The v1 runtime uses SDK-owned Contentful entry fields, the `ctfl-opt-aid` visitor profile cookie,
  an app-owned consent decision, and Core entry resolution. source:
  optimization-api-schemas-v1.2.0:packages/universal/api-schemas/src/contentful/OptimizedEntry.ts#OptimizedEntryFields;
  optimization-core-v1.3.0:packages/universal/core-sdk/src/constants.ts#ANONYMOUS_ID_COOKIE;
  optimization-core-v1.3.0:packages/universal/core-sdk/src/consent/ConsentPolicy.ts#hasEventConsent;
  optimization-core-v1.3.0:packages/universal/core-sdk/src/resolvers/OptimizedEntryResolver.ts#OptimizedEntryResolver.
- The Preview Panel consumes the Web and Core SDKs but does not expose the shared `clientId`
  configuration as its own initialization input. source:
  optimization-web-preview-panel-v1.2.0:packages/web/preview-panel/src/attachOptimizationPreviewPanel.ts#attachOptimizationPreviewPanel;
  optimization-web-preview-panel-v1.2.0:packages/web/preview-panel/package.json#dependencies.
