# Shared JavaScript bridge (internal)

> [!CAUTION]
>
> `@contentful/optimization-js-bridge` is internal bridge infrastructure for the native iOS and
> Android SDKs. It is not an application-facing SDK package. Native application integrations must
> use the iOS Swift Package or the Android Kotlin library instead.

This package owns the TypeScript adapter compiled into the UMD bundles consumed by the native iOS
SDK (JavaScriptCore) and the native Android SDK (QuickJS). One bridge source wraps
`@contentful/optimization-core`, exposes an engine-friendly callback API, and keeps the shared
optimization state machine available to native runtime code.

## When to use this package

Use this package when changing the native bridge contract, callback payloads, preview override
calls, or the generated bridge bundles consumed by the native SDKs. A single `src/index.ts` serves
both platforms — there is no separate per-platform bridge to keep in sync.

## Build flow

Edit the TypeScript source, then build. `rslib` compiles `src/index.ts` into two UMD bundles, and
the `postbuild` step copies each into its native SDK:

| Bundle                               | Destination                        |
| ------------------------------------ | ---------------------------------- |
| `optimization-ios-bridge.umd.js`     | iOS Swift Package resources        |
| `optimization-android-bridge.umd.js` | Android library `src/main/assets/` |

The two bundles are identical apart from the `library.name` analytics identifier, kept
platform-specific so iOS and Android events remain distinguishable.

The JS polyfills required by JavaScriptCore and QuickJS — `console`, `timers`, `fetch`, `crypto`,
`url`, `abort-controller`, `promise-utilities`, `text-encoding` — live in `src/polyfills/` and are
prepended verbatim to each emitted UMD bundle at build time. This is the single source of truth for
both platforms; each native SDK only registers the `__native*` host bindings for native fetch,
timers, logging, and UUID generation before evaluating the bundle.

```sh
pnpm --filter @contentful/optimization-js-bridge build
```

Do not hand-edit `dist/` output or the copied native bundles. Regenerate them through the build
flow.

## Architecture notes

For the bridge runtime contract, UMD bundle flow, prepended polyfills, native bindings, callback
shape, and lifecycle constraints, see [Native bridge architecture](./BRIDGE_ARCHITECTURE.md).

## Commands

Run commands from the monorepo root:

```sh
pnpm --filter @contentful/optimization-js-bridge typecheck
pnpm --filter @contentful/optimization-js-bridge test:unit
pnpm --filter @contentful/optimization-js-bridge build
```

For bridge contract, payload-shape, preview, or lifecycle changes, also validate the native iOS and
Android SDKs and the reference apps that exercise the changed behavior.

## Related

- [Native bridge architecture](./BRIDGE_ARCHITECTURE.md) - Shared bridge runtime and build notes
- [iOS SDK package](../../ios/README.md) - Native iOS SDK status and package layout
- [Android SDK package](../../android/README.md) - Native Android SDK status and package layout
- [Core preview support](../core-sdk/src/preview-support/README.md) - Shared preview override
  toolkit
