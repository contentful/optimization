# Bridge support (internal)

> [!CAUTION]
>
> `@contentful/optimization-core/bridge-support` is internal first-party bridge infrastructure. It
> is not an application-facing Core SDK surface and can change without a SemVer major bump.

This entry point exposes small helpers used by first-party SDK layers that need controlled access to
stateful Core internals without adding consumer-visible methods to `CoreStateful`.

Use it for:

- Hydrating a browser SDK instance from server-rendered `OptimizationData`.
- Wiring first-party preview tooling to the minimal signal and interceptor handles it needs.

Application integrations must use the framework SDK surface documented for their runtime.
