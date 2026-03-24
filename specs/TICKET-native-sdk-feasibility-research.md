# Native SDK Feasibility Research: iOS & Android

## Objective

Investigate the feasibility of creating native iOS (Swift) and Android (Kotlin) SDKs for the
Contentful Optimization suite that act as thin wrappers around the existing JavaScript SDK. The core
question: can `@contentful/optimization-core` serve as the single source of truth for business logic
across all platforms — web, Node, React Native, iOS, and Android — with the native SDKs providing
only platform-specific concerns (networking, storage, lifecycle, UI)?

## Approach

1. **Codebase analysis** — Map the full API surface, dependency graph, and platform abstraction
   boundaries already in place across the existing web, Node, and React Native SDKs to understand
   what business logic exists, what platform abstractions are already used, and where the JS/native
   boundaries naturally fall
2. **Industry research** — Investigate how comparable SDKs (Segment, LaunchDarkly, Amplitude,
   Mixpanel) handle multi-platform support, and whether any production examples exist of embedding
   JS engines in native mobile SDKs
3. **Runtime evaluation** — Assess JavaScript runtime options for each platform (JavaScriptCore,
   Hermes, QuickJS, V8, AndroidX JavaScriptEngine) on binary size, ES module support, performance,
   maintenance status, and ecosystem maturity
4. **Alternative comparison** — Evaluate the embedded JS approach against full native rewrites,
   Kotlin Multiplatform (KMP), and C/C++ shared cores
5. **Report generation** — Produce one detailed report per platform covering architecture, bridge
   design, risk analysis, and implementation estimates

## Key Considerations

### Single source of truth as the driving constraint

The Optimization SDK's business logic — personalization resolution, event building, Zod validation,
queue management, Preact signal-based state, interceptors — lives in TypeScript and is shared across
web, Node, and React Native. Any approach that reimplements this logic creates a second source of
truth that must be kept in sync. This constraint shapes the entire evaluation:

| Approach                 | Single source of truth?       | Effort    | Maintenance burden     |
| ------------------------ | ----------------------------- | --------- | ---------------------- |
| **Embedded JS**          | Yes — same JS runs everywhere | Medium    | Low (update JS bundle) |
| **Full native rewrite**  | No — 3+ codebases             | Very high | Very high              |
| **Kotlin Multiplatform** | No — 2 sources (TS + KT)      | High      | High                   |
| **C/C++ shared core**    | No — separate from JS         | Very high | High                   |

KMP is the strongest alternative — production-proven (Shopify, Netflix, Forbes) and Google-backed —
but it fundamentally creates two sources of truth. For a team that prioritizes JS SDK parity above
native performance, the embedded JS approach is the better fit.

### Runtime selection

**iOS — JavaScriptCore:** Zero binary overhead (built into iOS), Apple-maintained, explicitly
permitted by App Store guidelines (2.5.2), debuggable via Safari Web Inspector (iOS 16.4+). Key
limitation: no JIT in embedded mode (~7-15x slower than WKWebView), but acceptable for our
lightweight workload (JSON processing, HTTP, simple logic).

**Android — QuickJS (via quickjs-kt):** Smallest available engine (~350 KB/ABI), full ES2023
support, excellent Kotlin bindings with coroutine integration. Validated in production by Cash App's
Zipline framework. Chosen over Hermes (3-4x larger, standalone use undocumented), V8 (10-20 MB/ABI,
J2V8 abandoned), and AndroidX JavaScriptEngine (Android 13+ only).

### JS/native boundary

The boundary follows the pattern the React Native SDK already establishes:

- **JS layer (all business logic):** CoreStateful, resolvers, EventBuilder, API client,
  interceptors, queue policy, Zod validation, Preact signals
- **Bridge layer (polyfills):** `fetch` → URLSession/OkHttp, `setTimeout` →
  DispatchQueue/coroutines, `console` → os.log/Logcat, `crypto.randomUUID` → platform UUID
- **Native layer (platform-only):** App lifecycle, connectivity monitoring, secure storage, view
  hierarchy access, gesture tracking, UI components

### Industry context

No major analytics/personalization SDK currently embeds a JS engine in native mobile SDKs. Segment,
LaunchDarkly, Amplitude, and Mixpanel all use native-per-platform implementations or share code only
within the same language family. However, companies like Social Tables (Cvent), Lucid (Lucidchart),
and Skyscanner have shipped this pattern in production apps. Cash App's Zipline validates QuickJS at
scale on Android. This is a less-traveled but viable path, chosen specifically because our canonical
business logic lives in TypeScript.

### Risks

**Highest risks:** Polyfill correctness (especially `fetch`), debugging difficulty in embedded
runtimes, bridge type safety across JSON serialization boundaries.

**Mitigations:** Contract tests generated from Zod schemas, integration tests comparing bridged SDK
behavior vs. direct JS SDK, Safari Web Inspector for iOS debug builds, robust error bridging with JS
stack traces.

## Outputs

| Artifact           | Location                             |
| ------------------ | ------------------------------------ |
| iOS SDK report     | `specs/REPORT-ios-native-sdk.md`     |
| Android SDK report | `specs/REPORT-android-native-sdk.md` |

Each report covers: architecture diagrams, runtime evaluation, JS/native boundary definition, bridge
mechanics, risk assessment (high/medium/low with mitigations), bundle size estimates, app store
considerations, threading model, debugging approaches, comparison with alternative approaches,
implementation phases, and key dependencies.

## Preliminary Effort Estimates

| Phase                             | Duration       | Scope                                                                          |
| --------------------------------- | -------------- | ------------------------------------------------------------------------------ |
| Phase 1: Foundation               | 2-3 weeks      | Bridge layer, polyfills, JS bundler pipeline, basic CoreStateful instantiation |
| Phase 2: Core API                 | 2-3 weeks      | Full public API, state observation, persistence, lifecycle integration         |
| Phase 3: Testing & Polish         | 2-3 weeks      | Unit/integration tests, performance benchmarking, memory profiling, docs       |
| Phase 4: View Tracking (optional) | 2-4 weeks      | Native visibility/tap/screen tracking, preview panel                           |
| **Total per platform**            | **8-13 weeks** | Phases 1-3 for production-ready core; Phase 4 for full feature parity          |

## Next Steps

- Team review of both reports to align on approach (embedded JS vs. KMP vs. hybrid)
- If proceeding with embedded JS: build a proof-of-concept on one platform (iOS recommended —
  simpler due to built-in JSC) to validate the polyfill layer and bridge performance before
  committing to full implementation
- Evaluate whether Zod Mini adoption in the core SDK could reduce the embedded bundle size
- Define the minimum viable API surface for V1 native SDKs
