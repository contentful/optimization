# Preview support (internal)

> [!CAUTION]
>
> `@contentful/optimization-core/preview-support` is internal first-party preview infrastructure. It
> is not part of the application-facing Core SDK surface and can change without a SemVer major bump.
> Application integrations must use the preview-panel surface documented by their platform SDK.

This entry point ships the cross-platform preview-panel toolkit used by React Native preview
support, the iOS JavaScriptCore bridge, and additional first-party preview surfaces. It owns the
preview override state machine, preview view-model builder, Contentful content-model mappers, and
minimal Contentful fetch helpers.

## When to use this internal entry

Use this entry only from first-party preview tooling or platform bridge code that must share preview
override semantics. Platform-specific preview UI belongs in the platform SDK; Contentful
content-model knowledge for `nt_audience`, `nt_experience`, and `nt_config` belongs here.

```ts
import {
  PreviewOverrideManager,
  buildPreviewModel,
  createAudienceDefinitions,
  createExperienceDefinitions,
  fetchAudienceAndExperienceEntries,
} from '@contentful/optimization-core/preview-support'
```

## Package surface

| Surface                                        | Purpose                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `@contentful/optimization-core/bridge-support` | Wires first-party preview consumers into internal SDK signals           |
| `PreviewOverrideManager`                       | Owns audience and variant override state and applies state interceptors |
| `applyOptimizationOverrides`                   | Pure merge helper for applying override maps to selected optimizations  |
| `buildPreviewModel`                            | Builds the UI view model from definitions, SDK signals, and overrides   |
| Entry mappers                                  | Convert Contentful audience and experience entries into preview shapes  |
| Contentful fetch helpers                       | Fetch paginated `nt_audience` and `nt_experience` entries               |
| Types and constants                            | Preview DTOs, override state shapes, minimal Contentful types, and IDs  |

The toolkit pairs with `@contentful/optimization-core/bridge-support`: first-party hosts call
`getPreviewPanelBridge()` to read the signal handles and state interceptor access needed by
preview-support helpers.

> [!IMPORTANT]
>
> This bridge intentionally exposes mutable internal signals for first-party preview tooling. It is
> required for immediate local overrides without network round-trips and is not a general-purpose
> extension point.

## Behavior notes

- `PreviewOverrideManager` registers a Core state interceptor so audience and variant overrides
  survive API refreshes. It can activate or deactivate audiences, set or reset individual variant
  overrides, reset all overrides back to the captured baseline, and remove its interceptor with
  `destroy()`.
- `applyOptimizationOverrides` is the pure merge helper behind that state rewrite. It preserves
  selected optimizations that are not overridden and adds explicit override entries when needed.
- `buildPreviewModel` groups experience definitions under their audiences, adds the synthetic "All
  Visitors" bucket for experiences without an audience target, enriches each experience with current
  and natural variant state, and sorts the result deterministically for preview UI display.
- Entry mappers encode the Optimization Contentful content-model contract for `nt_audience`,
  `nt_experience`, and `nt_config`, including variant distribution percentages and display names
  sourced from linked entries.
- Contentful fetch helpers page through `nt_audience` and `nt_experience` entries using a minimal
  `getEntries` contract. This package does not depend on the Contentful SDK directly.

## What belongs elsewhere

- Platform-specific preview UI belongs in the Web, React Native, iOS, or another platform SDK.
- Application setup belongs in the platform SDK README or integration guide.
- Exhaustive method signatures, callback payloads, and exported type details belong in generated
  TypeDoc reference.

## Related

- [Core SDK README](../../README.md) - package-level Core orientation
- [React Native SDK README](../../../../react-native-sdk/README.md) - mobile preview-panel surface
- [Shared JS bridge README](../../../optimization-js-bridge/README.md) - native bridge consumer
- [Core SDK generated reference](https://contentful.github.io/optimization/modules/_contentful_optimization-core.html) -
  exported Core reference, including preview-support types that are re-exported through first-party
  packages
