# iOS JavaScriptCore Bridge (internal)

> [!CAUTION]
>
> `@contentful/optimization-ios-bridge` is internal bridge infrastructure for the native iOS SDK. It
> is not an application-facing SDK package. iOS application integrations should use the Swift
> Package surface in [`../ContentfulOptimization`](../ContentfulOptimization/) instead.

This package owns the TypeScript adapter compiled into the JavaScriptCore UMD bundle consumed by the
native Swift package. The bridge wraps `@contentful/optimization-core`, exposes a
JavaScriptCore-friendly callback API, and keeps the shared optimization state machine available to
Swift runtime code.

## When to Use This Package

Use this package when changing the JavaScriptCore bridge contract, callback payloads, preview
override calls, or the generated bridge bundle consumed by the native Swift SDK. Keep bridge shapes
aligned with Swift models under `../ContentfulOptimization/Sources/ContentfulOptimization/Core/`.

## Package Surface

| Surface                 | Purpose                                                                      |
| ----------------------- | ---------------------------------------------------------------------------- |
| TypeScript bridge entry | Wraps Core stateful behavior behind JavaScriptCore-friendly callbacks        |
| Generated UMD bundle    | Runtime artifact copied into Swift Package resources by the build flow       |
| Swift model handoff     | JSON payload shapes consumed by the native Swift SDK                         |
| Preview bridge calls    | First-party preview override calls aligned with Core preview-support helpers |

Application developers should not depend on this package. The public iOS integration surface is the
Swift Package under `../ContentfulOptimization/`.

## Build Flow

Edit TypeScript source in this package, then build the bridge. The package `postbuild` step copies
`dist/optimization-ios-bridge.umd.js` into the Swift Package resources directory:

```sh
pnpm --filter @contentful/optimization-ios-bridge build
```

Do not hand-edit `dist/` output or the copied Swift resource bundle. Regenerate it through the build
flow.

## Commands

Run commands from the monorepo root:

```sh
pnpm --filter @contentful/optimization-ios-bridge typecheck
pnpm --filter @contentful/optimization-ios-bridge build
```

For bridge contract, payload-shape, preview, or lifecycle changes, also validate the Swift Package
or targeted iOS reference app flows that exercise the changed behavior.

## Related

- [iOS SDK package](../README.md) - Native iOS SDK status and package layout
- [iOS code map](../CODE_MAP.md) - Current native iOS architecture map
- [Core preview support](../../universal/core-sdk/src/preview-support/README.md) - Shared preview
  override toolkit used by first-party preview surfaces
