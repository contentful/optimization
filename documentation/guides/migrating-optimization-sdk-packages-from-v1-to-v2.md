---
fern:
  slug: migrate-optimization-sdk-v1-to-v2
  section: Migration guides
  description: >-
    Upgrade Optimization SDK packages from their final v1 releases to v2 while preserving the
    intended Contentful space environment and updating direct API and schema integrations.
---

# Migrate Optimization SDK packages from v1 to v2

Use this guide when an application or SDK layer uses one or more v1 Optimization packages and you
want to upgrade those packages to v2 without changing the application's personalization design.

## What changes

Version 2 renames the shared `clientId` configuration key to `spaceId`; both keys contain the same
Contentful Space ID. The default Contentful environment also changes from `main` to `master`. For
most applications, the migration is limited to upgrading directly installed packages, renaming that
configuration key, and preserving the intended environment.

Additional changes apply only when your code directly uses the low-level API Client, inspects its
URLs, or imports its schemas. The Experience API, which returns the visitor profile and selected
optimizations, moves from v2 organization routes to v3 space routes. The Insights API, which receives
interaction events, moves from v1 organization routes to v2 space routes. Direct schema consumers
must also handle updated response and event unions, including Experience Optimization (ExO) node
events.

This upgrade does not require a Contentful content-model migration or a profile-cookie reset. After
updating the version-specific surfaces below, continue to use the integration guide for your
runtime's consent, entry resolution, event, tracking, preview, and cache behavior.

## Before you migrate

Gather these inputs:

- Every directly installed Optimization package and its current version. Include packages used only
  by build tools, tests, or internal SDK layers.
- The lockfile entries for Optimization packages so you can check for mixed v1 and v2 dependency
  trees after installation.
- The Contentful Space ID used by the integration. In v1 this value may be stored under a variable
  named `clientId`; the name changes, but the value is the Contentful Space ID.
- The Contentful environment the application currently uses. If v1 omits `environment`, record
  `main` as the effective value before upgrading.
- Every `clientId`, `client-id`, `OptimizationConfig(clientId: ...)`, and
  `OptimizationConfig(clientId = ...)` initialization site.
- Any direct API Client calls, network allow-lists, reverse proxies, request mocks, response-envelope
  parsing, exhaustive `Change` handling, or event-schema validation.
- One entry with a replacement **variant** attached to an **experience** in Contentful. An experience
  is the authored rule that selects among the original entry—the **baseline**—and its variants. For
  this test, target all visitors so the request matches automatically, and give the variant visibly
  different content. The integration guide for your runtime shows where the fetched entry is passed
  to the SDK.

## Migration path

1. Inventory the directly installed packages using the matrix below. Do not add transitive
   Optimization packages as direct dependencies solely for this migration.
2. While still on v1, set `environment` explicitly to the environment the application already uses.
   This preserves behavior across the default change.
3. Upgrade all directly installed packages in the same change. Use v2 for packages in the
   coordinated release and `1.2.1` for the deprecated API Schemas compatibility facade if the app
   still installs it.
4. Replace shared `clientId` configuration with `spaceId`, then update any Web Component and native
   initialization surfaces.
5. If the app directly consumes the API Client or its schemas, update the route-dependent
   infrastructure and exhaustive schema handling described below.
6. Reinstall dependencies and inspect the lockfile for unintended mixed v1/v2 copies.
7. Run the runtime-specific checks in [Validate the migration](#validate-the-migration).

## Replace legacy surfaces

### Choose the packages to upgrade

Upgrade only the packages the application installs directly. Framework and environment packages
bring their required shared packages through their declared dependencies.

| Package                                      | Final v1 | Migration target |
| -------------------------------------------- | -------- | ---------------- |
| `com.contentful.java:optimization-android`   | `1.1.0`  | `2.0.0`          |
| `ContentfulOptimization`                     | `1.1.0`  | `2.0.0`          |
| `@contentful/optimization-api-client`        | `1.1.1`  | `2.0.0`          |
| `@contentful/optimization-core`              | `1.3.0`  | `2.0.0`          |
| `@contentful/optimization-nextjs`            | `1.3.0`  | `2.0.0`          |
| `@contentful/optimization-node`              | `1.2.1`  | `2.0.0`          |
| `@contentful/optimization-react-native`      | `1.1.0`  | `2.0.0`          |
| `@contentful/optimization-react-web`         | `1.3.0`  | `2.0.0`          |
| `@contentful/optimization-web`               | `1.3.0`  | `2.0.0`          |
| `@contentful/optimization-web-preview-panel` | `1.2.0`  | `2.0.0`          |
| `@contentful/optimization-api-schemas`       | `1.2.0`  | `1.2.1`          |

The API Schemas package remains on its own v1 version line. It is a deprecated compatibility package
that re-exports schemas now owned by API Client and Core. If your code imports
`@contentful/optimization-api-schemas`, migrate those imports to the owning package entry points when
practical; do not wait for a v2 release of this package. See the
[`@contentful/optimization-api-schemas` migration table](../../packages/universal/api-schemas/README.md#migrate-imports).

The Preview Panel's `attachOptimizationPreviewPanel(...)` call does not take `clientId` directly.
Upgrade its package with the Web SDK packages it consumes, then confirm that the panel still connects
to the upgraded Web SDK.

### Replace shared configuration

In JavaScript and TypeScript SDK configuration, rename `clientId` to `spaceId`. This includes direct
construction, React and React Native root/provider props, Next.js binders, and configuration objects
passed through application helpers.

The value does not change: both names refer to the Contentful Space ID. Environment-variable names
are app-owned, so you may retain an existing variable name temporarily, but renaming it to describe
a Space ID makes the new contract clearer.

**Adapt this to your use case:**

```diff
 const optimization = new ContentfulOptimization({
-  clientId: process.env.CONTENTFUL_CLIENT_ID,
+  spaceId: process.env.CONTENTFUL_SPACE_ID,
   environment: process.env.CONTENTFUL_ENVIRONMENT,
 })
```

Follow the current integration guide for the exact construction surface in
[Node](./integrating-the-node-sdk-in-a-node-app.md),
[Web](./integrating-the-web-sdk-in-a-web-app.md),
[React Web](./integrating-the-react-web-sdk-in-a-react-app.md),
[Next.js App Router](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md),
[Next.js Pages Router](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md), or
[React Native](./integrating-the-react-native-sdk-in-a-react-native-app.md).

### Preserve the intended environment

The v1 default is `main`; the v2 default is `master`. An application that omitted `environment` in
v1 would silently address a different Contentful environment after upgrading if you continue to
omit it.

While the application still uses v1, make the existing effective environment explicit. Keep the v1
`clientId` key in this preparatory edit:

**Adapt this to your use case:**

```ts
const optimization = new ContentfulOptimization({
  clientId: process.env.CONTENTFUL_CLIENT_ID,
  environment: 'main',
})
```

After upgrading the packages and renaming the key for v2, preserve that same environment value:

**Adapt this to your use case:**

```ts
const optimization = new ContentfulOptimization({
  spaceId: process.env.CONTENTFUL_SPACE_ID,
  // Keep "main" when that is the environment the v1 integration used.
  environment: 'main',
})
```

The literal environment value is owned by your Contentful space. Use `master` only when that is the
environment the application should address. After migration, you may omit the field when the v2
`master` default matches your intended environment.

### Update Web Component configuration

For an SDK-owned `<ctfl-optimization-root>`, rename the HTML attribute and the corresponding DOM
property. The element requires a Space ID unless you assign an existing SDK instance through its
`sdk` property.

**Adapt this to your use case:**

```diff
-<ctfl-optimization-root client-id="your-space-id" environment="main">
+<ctfl-optimization-root space-id="your-space-id" environment="main">
   <!-- Existing personalized content -->
 </ctfl-optimization-root>
```

For imperative DOM code, replace `root.clientId` with `root.spaceId`. See the
[Web SDK integration guide](./integrating-the-web-sdk-in-a-web-app.md) for the current Web Component
surface.

### Update native initialization

Swift and Kotlin use the same Contentful Space ID and environment as the JavaScript SDKs. Rename the
initializer argument and keep the existing environment explicit.

For Swift:

**Adapt this to your use case:**

```diff
 let config = OptimizationConfig(
-    clientId: contentfulSpaceId,
+    spaceId: contentfulSpaceId,
     environment: "main"
 )
```

For Kotlin:

**Adapt this to your use case:**

```diff
 val config = OptimizationConfig(
-    clientId = contentfulSpaceId,
+    spaceId = contentfulSpaceId,
     environment = "main",
 )
```

Continue with the current [SwiftUI](./integrating-the-optimization-ios-sdk-in-a-swiftui-app.md),
[UIKit](./integrating-the-optimization-ios-sdk-in-a-uikit-app.md),
[Android Compose](./integrating-the-optimization-android-sdk-in-a-compose-app.md), or
[Android Views](./integrating-the-optimization-android-sdk-in-a-views-app.md) integration guide.

### Update direct API Client integrations

Skip this section if the application uses an environment or framework SDK and does not inspect API
URLs. Those SDKs construct the API paths internally.

Direct API Client consumers still replace `clientId` with `spaceId`. Update any proxy rules,
network allow-lists, request mocks, or diagnostics that match the old paths:

| Transport      | V1 path prefix                                                  | V2 path prefix                                          |
| -------------- | --------------------------------------------------------------- | ------------------------------------------------------- |
| Experience API | `v2/organizations/{clientId}/environments/{environment}`        | `v3/spaces/{spaceId}/environments/{environment}`        |
| Insights API   | `v1/organizations/{clientId}/environments/{environment}/events` | `v2/spaces/{spaceId}/environments/{environment}/events` |

Do not construct these paths in ordinary SDK integrations. Configure `spaceId` and `environment`
and let the API Client own the route. See the
[`@contentful/optimization-api-client` README](../../packages/universal/api-client/README.md) for
the current direct-client configuration.

### Update direct schema consumers

Skip this section unless application, adapter, test, or tooling code imports API schemas or performs
exhaustive checks on response and event unions. A **response envelope** is the outer
`{ data, message, error }` object returned by the Experience API. `Change` and the event types are
**discriminated unions**: TypeScript and the runtime schemas choose a member from its `type` field.
Search imports from `@contentful/optimization-api-client/api-schemas` or the deprecated
`@contentful/optimization-api-schemas`, plus `switch` statements that branch on `.type`.

| V1 assumption                                                         | V2 contract                                                                        |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Response-envelope `error` is `boolean \| null`                        | `error` is `{ code: string } \| null`                                              |
| Every `Change` has type `Variable`                                    | `Change` is discriminated across `Variable`, `Experience`, and `Fragment`          |
| Experience events include `alias` and `group`                         | The Experience union includes `exo_node_view`; `alias` and `group` are not members |
| Insights events are `component`, `component_click`, `component_hover` | The union also includes `exo_node_view`, `exo_node_click`, and `exo_node_hover`    |

`Variable` changes carry Custom Flag values; `Experience` and `Fragment` changes carry selected
Contentful entity variants. The `exo_node_*` event names describe Experience Optimization node
views, clicks, and hovers. Update exhaustive `switch` statements and schema fixtures rather than
coercing v2 payloads into the old union. Import Experience and Insights schemas from
`@contentful/optimization-api-client/api-schemas`; import Contentful CDA schemas and helpers from
`@contentful/optimization-core/api-schemas`. The deprecated
`@contentful/optimization-api-schemas` facade remains available for compatibility, but new imports
should use the owning packages.

## Validate the migration

Run the checks that match the application's installed packages:

1. Inspect resolved versions with the package manager the app already uses:

   | Runtime               | Inspection mechanism                                                                    |
   | --------------------- | --------------------------------------------------------------------------------------- |
   | pnpm                  | `pnpm why @contentful/optimization-web` with each directly installed JavaScript package |
   | npm                   | `npm ls @contentful/optimization-web` with each directly installed JavaScript package   |
   | Yarn                  | `yarn why @contentful/optimization-web` with each directly installed JavaScript package |
   | Swift Package Manager | Xcode's **Package Dependencies** view or the app's `Package.resolved`                   |
   | Gradle                | The app module's `dependencies` task for its runtime classpath configuration            |

   Every directly installed package in the matrix should resolve to its migration target. Transitive
   packages may follow their own version lines; `@contentful/optimization-api-schemas@1.2.1` is the
   expected exception in this release.

2. Start the application with the intended `spaceId` and an explicit `environment`. If the app
   already logs or proxies Optimization requests, confirm their space and environment path segments.
   If no request diagnostic already exists, continue with the smoke checks below rather than adding
   network instrumentation solely for migration. Event acceptance and variant rendering show that
   the upgraded flow works, but they do not by themselves prove the exact transport path because an
   SDK can use queued, handed-off, or cached state.
3. Trigger and observe the runtime's normal first event. An **accepted** event is one the local SDK
   consent policy allows it to send:

   | Runtime           | Action and observable proof                                                                                                                                                                                                                                                                                                                                                                |
   | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | Node              | Exercise the existing request that calls `page()` or `identify()` and confirm its returned result has `accepted: true`; see the [Node quick start](./integrating-the-node-sdk-in-a-node-app.md#quick-start).                                                                                                                                                                               |
   | Web and React Web | Load a tracked route and inspect the app's existing event diagnostics; the [Web page-event section](./integrating-the-web-sdk-in-a-web-app.md#page-and-route-events) and [React Web page-event section](./integrating-the-react-web-sdk-in-a-react-app.md#page-events-and-route-tracking) show the runtime-owned signals.                                                                  |
   | Next.js           | Load a route once and confirm the bound root or tracker owns one page event; use the [App Router](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md#the-bound-root-and-page-events) or [Pages Router](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md#the-bound-root-and-page-events) check.                                                             |
   | React Native      | Open a tracked screen and observe the accepted `screen` event through `states.eventStream`; see [Screen and navigation tracking](./integrating-the-react-native-sdk-in-a-react-native-app.md#screen-and-navigation-tracking).                                                                                                                                                              |
   | iOS               | Subscribe to `client.eventStream`, open a tracked screen, and confirm it emits the accepted `screen` event; see [SwiftUI analytics diagnostics](./integrating-the-optimization-ios-sdk-in-a-swiftui-app.md#custom-events-and-analytics-diagnostics) or [UIKit analytics diagnostics](./integrating-the-optimization-ios-sdk-in-a-uikit-app.md#custom-events-and-analytics-diagnostics).    |
   | Android           | Collect `client.eventStream`, open a tracked screen, and confirm it emits the accepted `screen` event; see [Compose analytics diagnostics](./integrating-the-optimization-android-sdk-in-a-compose-app.md#custom-events-and-analytics-diagnostics) or [Views analytics diagnostics](./integrating-the-optimization-android-sdk-in-a-views-app.md#custom-events-and-analytics-diagnostics). |

4. Load the authored all-visitors experience gathered before migration. Confirm its visibly different
   variant, not only the baseline, resolves.
5. If the existing integration emits interaction or custom events, trigger one and confirm its
   existing diagnostic or analytics-forwarding path still observes it. Do not add a new event solely
   for this migration.
6. If the existing integration supports denied consent, exercise that path and use the runtime
   integration guide's consent section to confirm the event appears in `onEventBlocked`,
   `blockedEventStream`, or the native equivalent instead of being sent. Blocked-event diagnostics
   are evidence; the SDK does not replay the blocked call after consent changes.
7. If the app uses direct schemas, run its response and event fixture tests with v2 payload shapes.
8. If the app uses the Preview Panel, open it and confirm it can select a variant through the
   upgraded Web SDK instance.

## Troubleshooting

| Symptom                                                        | Likely cause                                                                  | Action                                                                                                    |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Type error says `clientId` is unknown or `spaceId` is required | A v1 configuration key remains                                                | Replace the key at that initialization boundary and pass the Contentful Space ID                          |
| Personalization works against unexpected content               | The omitted environment changed from `main` to `master`                       | Set `environment` explicitly to the Contentful environment the v1 integration used                        |
| `<ctfl-optimization-root>` reports that `space-id` is required | The element still uses `client-id` or no SDK instance is assigned             | Rename the attribute/property or assign the existing SDK through `sdk`                                    |
| Requests receive route-not-found or proxy errors               | A proxy, allow-list, or mock still expects organization-based v1/v2 API paths | Update route-dependent infrastructure to the space-based path prefixes in this guide                      |
| Type narrowing misses response changes or ExO events           | An exhaustive v1 schema check is still in place                               | Handle the v2 discriminated unions and update fixtures instead of casting the payload                     |
| Preview fails after otherwise successful migration             | Preview Panel and Web/Core packages are on incompatible major versions        | Align the directly installed Preview Panel and Web packages, reinstall, and inspect the resolved lockfile |

## Related guides

- [Choose the right SDK](./choosing-the-right-sdk.md)
- [Guides index](./README.md)
- [`@contentful/optimization-api-client` README](../../packages/universal/api-client/README.md)
- [`@contentful/optimization-api-schemas` migration table](../../packages/universal/api-schemas/README.md#migrate-imports)
