# iOS SDK Code Map — `packages/ios/`

## High-Level Overview

This diff introduces a complete **Contentful Optimization iOS SDK** — a Swift Package (iOS 15+/macOS
12+) that enables content personalization and analytics tracking for native iOS apps. The SDK runs
the existing JavaScript optimization core inside a **JavaScriptCore** context, bridged by a
TypeScript adapter layer. Swift code handles native concerns (persistence, networking, app
lifecycle, SwiftUI integration) while the JS engine handles personalization logic, profile
management, and analytics batching.

The architecture has two main sub-packages:

| Sub-package               | Language   | Purpose                                                                                                              |
| ------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------- |
| `ios-jsc-bridge/`         | TypeScript | Thin adapter wrapping `CoreStateful` from the optimization library, exposing a callback-based API for JavaScriptCore |
| `ContentfulOptimization/` | Swift      | SPM library providing public API, SwiftUI views, tracking, persistence, and the JSContext lifecycle                  |

---

## Component Diagram

```mermaid
graph TB
    subgraph "Public SwiftUI API"
        OR["OptimizationRoot\n<i>Root view that initializes the client\nand injects it into the environment</i>"]
        OE["OptimizedEntry\n<i>Resolves personalized content,\napplies view & tap tracking</i>"]
        OSV["OptimizationScrollView\n<i>Tracks scroll position, provides\nScrollContext to descendants</i>"]
        STM["ScreenTrackingModifier\n<i>.trackScreen(name:) modifier\nfor screen-level analytics</i>"]
    end

    subgraph "Tracking Engine"
        VTM["ViewTrackingModifier\n<i>SwiftUI modifier that reads geometry\nand scroll context for visibility</i>"]
        VTC["ViewTrackingController\n<i>State machine: initial → periodic →\nfinal view events with timers</i>"]
        TTM["TapTrackingModifier\n<i>Wraps content with TapGesture,\nemits TrackClickPayload</i>"]
    end

    subgraph "Core Client"
        OC["OptimizationClient\n<i>@MainActor ObservableObject — main facade.\nPublishes state, drives all bridge calls</i>"]
        CFG["OptimizationConfig\n<i>clientId, environment,\nAPI base URLs, StorageDefaults</i>"]
        ST["OptimizationState\n<i>Reactive snapshot: profile,\nconsent, canPersonalize, changes</i>"]
        ERR["OptimizationError\n<i>notInitialized, bridgeError,\nresourceLoadError, configError</i>"]
    end

    subgraph "JavaScriptCore Bridge"
        JSM["JSContextManager\n<i>Owns JSContext lifecycle: polyfills,\nUMD bundle, sync/async calls</i>"]
        BCM["BridgeCallbackManager\n<i>Generates unique callback pairs\nfor async JS ↔ Swift roundtrips</i>"]
        NP["NativePolyfills\n<i>Registers Swift-backed natives:\nfetch, timers, crypto, logging</i>"]
        PSL["PolyfillScriptLoader\n<i>Loads 8 JS polyfill scripts\nin correct order</i>"]
        UMD["optimization-ios-bridge.umd.js\n<i>Compiled TS bridge bundle —\nexposes globalThis.__bridge</i>"]
    end

    subgraph "TypeScript Bridge (ios-jsc-bridge/)"
        TSB["Bridge (index.ts)\n<i>Wraps CoreStateful, exposes\ncallback-based API on globalThis.__bridge</i>"]
    end

    subgraph "Infrastructure"
        PS["PersistentStore (protocol)\n<i>Abstract interface for profile,\nconsent, changes, personalizations</i>"]
        UDS["UserDefaultsStore\n<i>PersistentStore impl: UserDefaults\nwith in-memory write-through cache</i>"]
        ASH["AppStateHandler\n<i>Listens to UIKit lifecycle —\nflushes analytics on background</i>"]
        NM["NetworkMonitor\n<i>NWPathMonitor — flushes\nqueued events on reconnect</i>"]
    end

    subgraph "Debug / Preview"
        PPO["PreviewPanelOverlay\n<i>Floating gear FAB that opens\nthe debug sheet</i>"]
        PPC["PreviewPanelContent\n<i>Shows profile, audiences,\npersonalizations with overrides</i>"]
    end

    %% Public API → Core
    OR -->|"initializes & injects via\n@EnvironmentObject"| OC
    OR -->|"passes"| CFG
    OE -->|"calls personalizeEntry()"| OC
    OE -->|"applies"| VTM
    OE -->|"applies"| TTM
    STM -->|"calls screen()"| OC
    OSV -->|"provides ScrollContext\nvia environment"| VTM

    %% Tracking → Core
    VTM -->|"creates & drives"| VTC
    VTC -->|"emits TrackViewPayload"| OC
    TTM -->|"emits TrackClickPayload"| OC

    %% Core → Bridge
    OC -->|"owns & delegates all\nJS calls to"| JSM
    JSM -->|"registers callbacks via"| BCM
    JSM -->|"loads polyfills via"| PSL
    JSM -->|"registers natives via"| NP
    JSM -->|"loads & calls"| UMD

    %% TS Bridge compiles to UMD
    TSB -.->|"compiled to"| UMD

    %% Core → Infrastructure
    OC -->|"persists state via"| PS
    PS -->|"implemented by"| UDS
    ASH -->|"flushes on background"| OC
    NM -->|"flushes on reconnect"| OC

    %% Debug
    PPO -->|"opens sheet"| PPC
    PPC -->|"overrideAudience/Variant"| OC
```

### Data Flow: Async Bridge Call

```mermaid
sequenceDiagram
    participant Swift as OptimizationClient
    participant JSM as JSContextManager
    participant BCM as BridgeCallbackManager
    participant JS as __bridge (JSContext)

    Swift->>JSM: callAsync("identify", payload)
    JSM->>BCM: registerCallback(prefix: "identify")
    BCM-->>JSM: (successCb, errorCb) names
    JSM->>JS: __bridge.identify(payload, successCb, errorCb)
    JS-->>JSM: successCb(resultJSON)
    JSM-->>Swift: Result<String, Error>
```

### Data Flow: View Tracking Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Invisible: View appears
    Invisible --> Visible: visibleHeight/elementHeight ≥ threshold
    Visible --> Invisible: Below threshold
    Visible --> Visible: Timer fires → emit event

    state Visible {
        [*] --> Accumulating
        Accumulating --> InitialEvent: accumulatedTime ≥ viewTimeMs (2s)
        InitialEvent --> PeriodicUpdates: every viewDurationUpdateIntervalMs (5s)
    }

    Invisible --> FinalEvent: if ≥1 event emitted
    FinalEvent --> [*]: View disappears

    state "App Backgrounding" as BG {
        Visible --> Paused: willResignActive
        Paused --> Visible: didBecomeActive
    }
```

---

## Testing

### What's Covered (63 test methods, ~1030 lines)

| Area                                     | Tests                                                                                                                                                                                                                    | Coverage |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| **OptimizationConfig**                   | Serialization, defaults, nil URL omission                                                                                                                                                                                | 3 tests  |
| **OptimizationState**                    | Empty state, equality (incl. multi-key dictionaries), inequality                                                                                                                                                         | 4 tests  |
| **OptimizationError**                    | All error case descriptions                                                                                                                                                                                              | 1 test   |
| **PolyfillScriptLoader**                 | Loads all 8 scripts in order                                                                                                                                                                                             | 1 test   |
| **BridgeCallbackManager**                | Unique ID generation, auto-cleanup after invocation                                                                                                                                                                      | 2 tests  |
| **JSContextManager**                     | Initialize, destroy, getProfile, getState                                                                                                                                                                                | 4 tests  |
| **OptimizationClient**                   | Initial state, initialize, destroy, pre-init no-ops, not-initialized throws for all async methods (identify, page, screen, flush, trackView, trackClick), consent/reset/setOnline passthrough, personalizeEntry baseline | 14 tests |
| **TrackViewPayload / TrackClickPayload** | JSON serialization, optional field omission                                                                                                                                                                              | 4 tests  |
| **Event Publisher**                      | Events flow through Combine publisher                                                                                                                                                                                    | 1 test   |
| **Selected Personalizations**            | State updates propagate to published property                                                                                                                                                                            | 1 test   |
| **TrackingMetadata**                     | Extraction from entry/personalization dicts, defaults                                                                                                                                                                    | 2 tests  |
| **TrackingConfig**                       | Default values, custom values                                                                                                                                                                                            | 2 tests  |
| **ScrollContext**                        | Defaults, equality, inequality, coordinate space name                                                                                                                                                                    | 4 tests  |
| **ViewTrackingController**               | Initially invisible, becomes visible above threshold, stays invisible below, disappear resets, pause/resume, partial overlap, zero height ignored, scrolled past element, new cycle reset                                | 9 tests  |
| **Personalization**                      | Resolves baseline with no personalizations                                                                                                                                                                               | 1 test   |
| **NativePolyfills.TimerStore**           | Isolation, cancelAll, fired-removes-entry                                                                                                                                                                                | 3 tests  |
| **Timer lifecycle**                      | Register returns separate stores, destroy cancels timers                                                                                                                                                                 | 2 tests  |

### Plausible Gaps

- **Integration tests with real JS execution**: Most client tests use mocked JS contexts. End-to-end
  tests that exercise the full polyfill → UMD → bridge pipeline are limited to JSContextManager
  init/destroy.
- **ViewTrackingModifier / TapTrackingModifier**: No SwiftUI snapshot or UI tests for the modifier
  wrappers themselves (controller logic is tested in isolation).
- **PreviewPanel**: No tests for the debug panel views or override flows.
- **AppStateHandler / NetworkMonitor**: No tests for lifecycle event handling or network
  reconnection flushing.
- **UserDefaultsStore**: No explicit tests for persistence round-trips (load/save/clear).
- **Concurrent/reentrancy scenarios**: The `identify` continuation guard is tested implicitly but
  multi-call race conditions aren't explicitly covered.
- **Error paths in NativePolyfills.fetch**: Edge cases like network timeouts or malformed responses
  through the native fetch polyfill.
