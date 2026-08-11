# Preview bridge support (internal)

> [!CAUTION]
>
> `@contentful/optimization-core/bridge-support` is preview-only first-party infrastructure. It is
> not an application-facing Core SDK surface and can change without a SemVer major bump.

This entry point wires first-party preview tooling to the minimal signal and interceptor handles it
needs to synthesize immediate local preview state. That controlled writable-signal access is the
reason this functionality is a bridge.

This is not a generic internal channel between SDKs. General SDK composition, hydration, and
request-lifecycle coordination belong in purpose-specific public APIs that preserve the owning
SDK's invariants. Those APIs may primarily serve downstream SDKs while remaining available to
advanced consumers building custom integrations or using unsupported frameworks.

Application integrations should use the framework SDK surface documented for their runtime unless
they have an exceptional integration need served by one of those public SDK-integration APIs.
