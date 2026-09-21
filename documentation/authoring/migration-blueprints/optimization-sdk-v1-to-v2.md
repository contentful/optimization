---
migration: optimization-sdk-v1
archetype: migration
source: ../../internal/migration-knowledge/optimization-sdk-v1.md
guide: ../../guides/migrating-optimization-sdk-packages-from-v1-to-v2.md
---

# Optimization SDK v1 to v2 migration blueprint

## Reader goal

- **Use when:** An application or SDK layer uses one or more final-v1 Optimization packages.
- **Target result:** All directly installed Optimization packages use compatible v2 releases, retain
  the intended Contentful space environment, and pass the application's existing personalization and
  event checks.
- **Guide file:** `documentation/guides/migrating-optimization-sdk-packages-from-v1-to-v2.md`
- **Write after:** None.
- **First verification:** The upgraded app emits one accepted page or screen event and resolves one
  authored all-visitors variant in the same Contentful space and environment used before migration.

## Migration route

| Legacy surface                                            | Target route                                                           | Detail owner                                    |
| --------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| Final-v1 package set                                      | Compatible v2 application, framework, foundation, and tooling packages | This guide's package matrix                     |
| `clientId` shared configuration                           | Required `spaceId` configuration                                       | Target runtime integration guide and SDK KB     |
| Omitted `environment` resolving to `main`                 | Omitted `environment` resolving to `master`                            | Target runtime integration guide and SDK KB     |
| Web Component `client-id` / `clientId`                    | `space-id` / `spaceId`                                                 | Web integration guide and Web SDK source        |
| Swift and Kotlin `OptimizationConfig(clientId: ...)`      | `OptimizationConfig(spaceId: ...)`                                     | Native integration guides and native SDK source |
| Experience API v2 and Insights API v1 organization routes | Experience API v3 and Insights API v2 Contentful-space routes          | Shared API transport fact                       |
| V1 response and event schema unions                       | V2 response and ExO schema unions                                      | API Client source and API Schemas facade README |

## Section plan

| Section                               | Purpose                                                                                                                                   | Must route to                                                       | Fact sources                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Choose the packages to upgrade        | Prevent partial or invented upgrades by listing the last v1 and target release families, including the API Schemas exception.             | Package READMEs and package-specific installation instructions.     | [v1 package baselines](../../internal/migration-knowledge/optimization-sdk-v1.md#package-baselines)                                                                                                                                                                                                                                                                                                                                                                                                           |
| Replace shared configuration          | Apply the common `clientId` to `spaceId` change once across JavaScript environment and framework SDKs.                                    | Node, Web, React Web, Next.js, and React Native integration guides. | [v1 shared configuration](../../internal/migration-knowledge/optimization-sdk-v1.md#shared-configuration), [Web setup](../../internal/sdk-knowledge/web/web.md#setup--initialization-and-binding), [React Web setup](../../internal/sdk-knowledge/web/react-web.md#setup--initialization-and-binding), [Node setup](../../internal/sdk-knowledge/node/node.md#setup--initialization-and-binding), [React Native setup](../../internal/sdk-knowledge/native/react-native.md#setup--initialization-and-binding) |
| Preserve the intended environment     | Stop an omitted v1 `main` environment from silently becoming v2 `master`; require the reader to identify and set the intended value.      | Target runtime configuration section.                               | [v1 shared configuration](../../internal/migration-knowledge/optimization-sdk-v1.md#shared-configuration), [Web setup](../../internal/sdk-knowledge/web/web.md#setup--initialization-and-binding), [Next.js setup](../../internal/sdk-knowledge/web/nextjs-app-router.md#setup--initialization-and-binding)                                                                                                                                                                                                   |
| Update Web Component configuration    | Replace the root element's attribute/property without re-teaching Web Component integration.                                              | Web integration guide.                                              | [v1 Web Component](../../internal/migration-knowledge/optimization-sdk-v1.md#web-component-configuration), [v2 Web Component](../../internal/sdk-knowledge/web/web.md#components--hooks)                                                                                                                                                                                                                                                                                                                      |
| Update native initialization          | Apply the corresponding Swift and Kotlin initializer rename and preserve the environment.                                                 | SwiftUI, UIKit, Compose, and Views integration guides.              | [v1 native initialization](../../internal/migration-knowledge/optimization-sdk-v1.md#native-initialization), [v2 iOS setup](../../internal/sdk-knowledge/native/ios.md#setup--initialization-and-binding), [v2 Android setup](../../internal/sdk-knowledge/native/android.md#setup--initialization-and-binding)                                                                                                                                                                                               |
| Update direct API Client integrations | Limit route work to direct transport consumers, proxies, allow-lists, and mocks; environment/framework SDK users do not construct routes. | API Client README.                                                  | [v1 API routes](../../internal/migration-knowledge/optimization-sdk-v1.md#api-routes), [v2 API transport](../../internal/sdk-knowledge/shared/concepts.md#api-transport-scope)                                                                                                                                                                                                                                                                                                                                |
| Update direct schema consumers        | Identify response-envelope, change-union, event-union, and deprecated facade work without asking ordinary runtime users to edit schemas.  | API Client and API Schemas READMEs.                                 | [v1 schemas](../../internal/migration-knowledge/optimization-sdk-v1.md#response-and-event-schemas), [v1 integration boundaries](../../internal/migration-knowledge/optimization-sdk-v1.md#v1-integration-boundaries)                                                                                                                                                                                                                                                                                          |

## Handoffs

None.

## Link roles

- [Guides index](../../guides/README.md).
- [Node integration guide](../../guides/integrating-the-node-sdk-in-a-node-app.md).
- [Web integration guide](../../guides/integrating-the-web-sdk-in-a-web-app.md).
- [React Web integration guide](../../guides/integrating-the-react-web-sdk-in-a-react-app.md).
- [Next.js App Router integration guide](../../guides/integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md).
- [Next.js Pages Router integration guide](../../guides/integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md).
- [React Native integration guide](../../guides/integrating-the-react-native-sdk-in-a-react-native-app.md).
- [iOS SwiftUI integration guide](../../guides/integrating-the-optimization-ios-sdk-in-a-swiftui-app.md).
- [iOS UIKit integration guide](../../guides/integrating-the-optimization-ios-sdk-in-a-uikit-app.md).
- [Android Compose integration guide](../../guides/integrating-the-optimization-android-sdk-in-a-compose-app.md).
- [Android Views integration guide](../../guides/integrating-the-optimization-android-sdk-in-a-views-app.md).
- [`@contentful/optimization-api-client` README](../../../packages/universal/api-client/README.md).
- [`@contentful/optimization-api-schemas` README](../../../packages/universal/api-schemas/README.md).
