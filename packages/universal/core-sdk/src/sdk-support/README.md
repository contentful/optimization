# SDK support (internal)

> [!CAUTION]
>
> `@contentful/optimization-core/sdk-support` is internal first-party SDK infrastructure. It is not
> part of the application-facing Core SDK surface and can change without a SemVer major bump.
> Application integrations must use the public SDK methods documented by their platform SDK.

This entry point ships helper contracts used by first-party runtime and framework SDKs that build on
Core. It owns acceptance-aware current-state tracking for automatic page and screen emitters, where
an adapter must distinguish a consent-blocked event from an accepted offline-queued event.

## When to use this internal entry

Use this entry only from first-party SDK packages or native bridge code that coordinates automatic
current-state tracking. Application code should call public SDK methods such as `page()` and
`screen()` instead.

```ts
import {
  AcceptedCurrentStateTracker,
  pageWithEmissionResult,
} from '@contentful/optimization-core/sdk-support'
```

## Package surface

| Surface                       | Purpose                                                               |
| ----------------------------- | --------------------------------------------------------------------- |
| `AcceptedCurrentStateTracker` | Dedupes accepted current-state emissions and retries blocked attempts |
| `pageWithEmissionResult`      | Emits a page event and reports whether Core accepted it               |
| `screenWithEmissionResult`    | Emits a screen event and reports whether Core accepted it             |
| `EventEmissionResult`         | Shared accepted/data result contract for first-party SDK adapters     |

## What belongs elsewhere

- Application-facing event methods stay on the runtime SDKs.
- Router, navigation, lifecycle, and viewport logic belongs in framework or runtime SDK packages.
- Preview-panel state management belongs in `@contentful/optimization-core/preview-support`.
