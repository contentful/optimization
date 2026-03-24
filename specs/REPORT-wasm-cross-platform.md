# WebAssembly (WASM) as a Cross-Platform Strategy

## Executive Summary

This report evaluates WebAssembly as an alternative or complement to the embedded JS engine approach
for sharing the Optimization SDK's business logic across iOS, Android, and web. WASM promises a
"compile once, run everywhere" model — write core logic in a language like Rust, C++, or
AssemblyScript, compile to `.wasm`, and execute on any platform with a WASM runtime.

**Verdict:** WASM is not a practical path for our specific use case today. The fundamental blocker
is that **our existing TypeScript codebase cannot be compiled to WASM without a full rewrite or
embedding a JS engine inside WASM** (which adds complexity without benefit over our existing
embedded JS approach). WASM becomes interesting only if the team is willing to rewrite core logic in
Rust or a similar systems language — and even then, the mobile WASM runtime ecosystem is immature
compared to the embedded JS approach.

---

## 1. Can Our TypeScript/JavaScript Be Compiled to WASM?

### Direct compilation: Not possible

JavaScript and TypeScript **cannot be directly compiled to WebAssembly.** WASM is a compilation
target for languages with static type systems and explicit memory management (C, C++, Rust, Go,
AssemblyScript). JavaScript is dynamically typed with garbage collection — it's fundamentally
incompatible with WASM's linear memory model.

### Path A: Javy (QuickJS inside WASM)

Mozilla's [Javy](https://github.com/bytecodealliance/javy) takes a different approach: it embeds the
QuickJS JavaScript engine _inside_ a WASM module. The result is a `.wasm` file that can execute
arbitrary JavaScript.

**How it works:**

1. QuickJS is compiled to WASM via Emscripten
2. Your JS code is embedded as bytecode inside the WASM module
3. The WASM module runs on any WASM runtime (Wasmtime, Wasmer, wasm3)

**The problem for us:**

- This is literally **QuickJS running inside WASM running inside a native runtime** — three layers
  of interpretation
- **Javy disables the QuickJS event loop** — `async/await`, `fetch`, `setTimeout`, and Promises all
  throw at runtime. It is designed for synchronous, pure-computation functions (e.g., Shopify
  discount calculations)
- Performance is worse than running QuickJS directly (which is what our Android approach already
  does)
- Bundle size: ~869 KB (static linking) or ~1-16 KB + ~800 KB shared provider (dynamic linking)
- Still needs host functions for fetch, timers, etc. — same polyfill problem
- No benefit over directly embedding QuickJS via `quickjs-kt` on Android or using JSC on iOS

**Verdict:** Javy adds indirection without solving any problem we don't already solve better with
native JS engine embedding. Our SDK's reliance on async/await, fetch, and timers makes Javy
fundamentally incompatible without major architectural changes.

### Path A½: ComponentizeJS (SpiderMonkey inside WASM)

[ComponentizeJS](https://github.com/bytecodealliance/ComponentizeJS) takes a similar approach to
Javy but embeds Mozilla's **SpiderMonkey** engine inside WASM and produces Component Model-compliant
WASM components.

**Tradeoffs vs. Javy:**

- Produces standards-compliant WASM components (WIT interfaces)
- **~8 MB embedding size** — prohibitively large for a mobile SDK
- More capable than Javy (better JS feature support) but same fundamental problem: JS engine inside
  WASM inside a native runtime

**Verdict:** Even larger than Javy, same indirection problem. Not practical for mobile SDK
embedding.

### Path B: AssemblyScript (TypeScript-like → WASM)

[AssemblyScript](https://www.assemblyscript.org/) is a TypeScript-like language that compiles to
WASM. It uses TypeScript syntax but with a completely different runtime model (no GC, manual memory
management, statically typed).

**Limitations that block us:**

- Cannot use npm packages (Zod, Preact signals, es-toolkit) — they rely on JS runtime features
  AssemblyScript doesn't support
- No closures, no `Promise`, no `async/await` in the same way
- No dynamic object creation or prototype chains
- Would require a **complete rewrite** of core logic, not a port
- String handling is fundamentally different (UTF-16 vs. JS strings)
- No standard library for HTTP, JSON parsing, etc.

**Verdict:** Rewriting in AssemblyScript is essentially rewriting in a new language with fewer
capabilities than TypeScript. Not practical.

### Path C: Rewrite in Rust → WASM

Rust is the best-supported language for WASM compilation. Rewriting core logic in Rust and compiling
to WASM would produce a universal module.

**What this looks like:**

1. Rewrite `optimization-core` in Rust
2. Compile to `.wasm` with `wasm-pack` or `wasm-bindgen`
3. Run the `.wasm` module in browser (native WASM support), iOS (via Wasmer/wasm3), Android (via
   Wasmer/wasm3/Chicory)
4. Expose a C-compatible FFI for Swift and Kotlin to call into

**Tradeoffs:**

- **Effort:** Very high — complete rewrite in a different language
- **Maintenance:** New source of truth in Rust, diverges from existing JS SDK
- **Team skills:** Requires Rust expertise (steep learning curve)
- **Web integration:** WASM in the browser works well but has interop overhead with JS
  (serialization across the boundary)
- **Advantage:** True universal binary — same `.wasm` runs everywhere

**The UniFFI hybrid pattern (most practical Rust path):**

Mozilla's [UniFFI](https://github.com/mozilla/uniffi-rs) generates native Swift and Kotlin bindings
from Rust code — compiling to native libraries, not WASM, for mobile. This enables a hybrid
deployment:

1. Write core logic in Rust
2. Compile to **native libraries** for iOS (UniFFI → Swift bindings) and Android (UniFFI → Kotlin
   bindings)
3. Compile to **WASM** for web (via `wasm-bindgen`)

This is effectively **Rust as shared core** rather than WASM as shared runtime. WASM only serves the
web target; mobile gets native performance without a WASM interpreter. Mozilla Firefox uses this
exact pattern to share Rust code between iOS and Android. However, it still requires a full rewrite
from TypeScript to Rust.

**Verdict:** Only viable if the team is willing to make Rust the canonical implementation language.
The UniFFI hybrid is the strongest Rust path (native mobile performance, WASM for web), but it's a
bigger architectural shift than KMP and doesn't leverage the existing TypeScript investment.

---

## 2. WASM Runtimes on Mobile

### iOS

| Runtime        | Type                              | Size       | Status                                             | Notes                                                                                                                                                                                                                                       |
| -------------- | --------------------------------- | ---------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wasmer 5/6** | Interpreter only on iOS           | **~12 MB** | Active, official iOS support since v5.0 (Oct 2024) | Three backends: V8 (JIT-less), Wasmi, WAMR. Apple's JIT restriction forces interpreter mode. [SwiftyWasmer](https://github.com/helje5/SwiftyWasmer) provides Swift bindings.                                                                |
| **Wasmtime**   | Pulley interpreter (experimental) | ~15 MB     | Not officially iOS-supported                       | Has an experimental Pulley bytecode interpreter for portability. Not production-ready on iOS.                                                                                                                                               |
| **wasm3**      | Interpreter only                  | **~64 KB** | Minimal maintenance                                | Extremely lightweight. Used in production by [Shareup iOS app](https://shareup.app/blog/using-webassembly-on-ios/) for file encryption. Original developer impacted by Ukraine conflict; project accepts PRs but is not actively developed. |
| **WasmKit**    | Interpreter (pure Swift)          | Small      | Active development                                 | Written in Swift, maintained by the SwiftWasm community. Native Swift API, no C bridging.                                                                                                                                                   |
| **WasmEdge**   | AOT + interpreter                 | ~8 MB      | Active                                             | Not explicitly documented for iOS. Focus is server/edge/IoT.                                                                                                                                                                                |

**App Store compatibility:** Apple prohibits JIT compilation on iOS. All WASM runtimes must use
**interpreter-only** mode on iOS. This is explicitly supported by Wasmer (v5+) and wasm3.
Interpreter mode means execution is 10-100x slower than JIT/native.

**Memory concern:** WASM uses linear memory that is **grow-only** — it cannot be returned to the OS
once allocated. Figma reported that growing WASM memory crashes on some mobile devices. This is a
known limitation documented in the
[WASM design repo](https://github.com/WebAssembly/design/issues/1397).

### Android

| Runtime        | Type                 | Size             | Status                     | Notes                                                                                                                                                                                                                        |
| -------------- | -------------------- | ---------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wasmer 5/6** | JIT + interpreter    | ~12 MB           | Active, Android since v1.0 | V8 backend with full JIT on Android. Kotlin/JNI bindings.                                                                                                                                                                    |
| **wasm3**      | Interpreter only     | **~64 KB**       | Minimal maintenance        | Smallest option. Compiles via Android NDK.                                                                                                                                                                                   |
| **Chicory**    | Pure JVM (no native) | **~2 MB (est.)** | **1.0 stable**             | **Zero native dependencies** — pure Java. Android API 28+. Interpreter: 5-10% of native speed; AOT compiler: 30-50% of native speed (translates WASM → JVM bytecode → Dalvik/DEX). Powers QuickJs4j, SQLite4j in production. |
| **Chasm**      | Pure Kotlin (KMP)    | Small            | Early                      | Kotlin Multiplatform WASM runtime. Works on Android and iOS. Supports Wasm 3.0. Gradle plugin generates typesafe Kotlin interfaces from `.wasm` files.                                                                       |
| **WasmEdge**   | AOT + interpreter    | ~8 MB            | Active                     | Official Android support via NDK. Only arm64-v8a. CNCF sandbox project.                                                                                                                                                      |

**Chicory** is particularly interesting for Android — zero native dependencies means no NDK/JNI
complexity, and it compiles WASM to JVM bytecode at build time for near-native JVM performance. It's
powering real libraries (QuickJs4j, SQLite4j) in production.

**Chasm** is a new entrant worth watching — as a Kotlin Multiplatform project, it could provide a
single WASM runtime across both iOS and Android.

### Size comparison with embedded JS approach

| Approach                             | iOS size overhead                    | Android size overhead                 |
| ------------------------------------ | ------------------------------------ | ------------------------------------- |
| **Embedded JS (our recommendation)** | ~200-300 KB (JS bundle, JSC is free) | ~600-750 KB/ABI (QuickJS + JS bundle) |
| **WASM with wasm3**                  | ~64 KB + .wasm module                | ~64 KB + .wasm module                 |
| **WASM with Wasmer**                 | **~12 MB** + .wasm module            | **~12 MB** + .wasm module             |
| **WASM with Chicory (Android only)** | N/A                                  | ~2 MB + .wasm module                  |
| **WASM with Chasm (KMP)**            | Small + .wasm module                 | Small + .wasm module                  |

wasm3 is impressively small (~64 KB) but is minimally maintained and interpreter-only (10-100x
slower than JIT). Wasmer is production-grade but **12 MB is prohibitive for an SDK.** Chicory and
Chasm avoid native dependencies entirely but are newer.

---

## 3. WASI (WebAssembly System Interface)

WASI is a standard interface that provides WASM modules access to system resources (files,
networking, clocks, random numbers). It aims to make WASM modules portable across operating systems.

### Current state

| Capability              | WASI Preview 1 | WASI Preview 2 (2024+)   |
| ----------------------- | -------------- | ------------------------ |
| File system             | Basic          | Improved                 |
| Clocks/time             | Yes            | Yes                      |
| Random numbers          | Yes            | Yes                      |
| **HTTP/networking**     | **No**         | **Proposed (wasi-http)** |
| **Timers (setTimeout)** | **No**         | **No**                   |
| Environment variables   | Yes            | Yes                      |
| Sockets                 | No             | Proposed                 |

**Critical gap:** WASI does not provide HTTP networking or timer APIs. Our SDK's core dependencies
on `fetch` and `setTimeout` would still need host-provided functions — the same polyfill problem we
face with embedded JS engines. WASI doesn't eliminate the bridge layer.

### wasi-http

The `wasi-http` proposal is part of WASI Preview 2 and would provide standardized HTTP client
capabilities. However:

- It's still emerging and not widely supported across runtimes
- Mobile WASM runtimes have limited WASI Preview 2 support
- Even with `wasi-http`, the host must provide the actual HTTP implementation

### WASI 0.3 (upcoming)

WASI 0.3 is expected to add **native async support** via the Component Model, which would address
the fundamental synchronous limitation. However:

- Release timeline is uncertain (originally targeted first half 2025, likely delayed)
- Mobile runtime support will lag further behind
- Even with async, the host must still implement the underlying platform operations

---

## 4. The Fundamental Problem: Interop Overhead

WASM modules communicate with the host environment through a narrow interface:

- **Linear memory:** A flat byte array shared between WASM and the host
- **Function imports/exports:** Simple scalar types (i32, i64, f32, f64)
- **No native object passing:** Complex objects (JSON, strings, arrays) must be serialized into
  linear memory and deserialized on the other side

This means:

```
Swift/Kotlin                    WASM module
    │                               │
    ├── Serialize payload to JSON ──►
    │   Copy into WASM linear memory│
    │                               ├── Deserialize from memory
    │                               ├── Execute business logic
    │                               ├── Serialize result
    ◄── Read from linear memory ────┤
    ├── Deserialize result          │
    │                               │
```

This is **the same serialization overhead** as the embedded JS approach, but with more manual memory
management. The WASM Component Model aims to improve this, but it's not mature on mobile runtimes.

### Async operations

WASM is fundamentally **synchronous**. It cannot natively:

- Make HTTP requests
- Set timers
- Await promises
- Perform I/O

All async operations must be delegated to the host via imported functions. The host calls back into
WASM when the operation completes. This creates the same callback bridging complexity as the
embedded JS approach.

---

## 5. Comparison: WASM vs. Previously Evaluated Approaches

| Factor                     | Embedded JS (JSC/QuickJS)                                        | WASM (rewrite in Rust)                                | Rust + UniFFI (hybrid)               | WASM (Javy/JS-in-WASM)                           | KMP                              | Native rewrite            |
| -------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------ | ------------------------------------------------ | -------------------------------- | ------------------------- |
| **Reuse existing TS code** | Yes — runs as-is                                                 | No — full rewrite                                     | No — full rewrite                    | Partially — JS runs in QuickJS-in-WASM           | No — rewrite in Kotlin           | No — rewrite per platform |
| **Single source of truth** | Yes (JS SDK)                                                     | Yes (Rust)                                            | Yes (Rust)                           | Yes (JS SDK, roundabout)                         | No (KT + TS)                     | No (3+ codebases)         |
| **Binary size (iOS)**      | ~200-300 KB                                                      | ~100 KB (wasm3) to ~12 MB (Wasmer)                    | Small (native lib)                   | ~869 KB - 8 MB                                   | Small                            | Smallest                  |
| **Binary size (Android)**  | ~600-750 KB                                                      | ~100 KB (wasm3) to ~12 MB (Wasmer)                    | Small (native lib)                   | ~869 KB - 8 MB                                   | Small                            | Smallest                  |
| **Performance**            | Good (JSC has JIT in WKWebView; QuickJS adequate for light work) | Mixed (wasm3 slow, Wasmer JIT fast on Android)        | Best (native compilation)            | Poor (3 layers of interpretation)                | Best (native)                    | Best (native)             |
| **Polyfill/bridge needs**  | fetch, timers, console, crypto                                   | fetch, timers, console, crypto — same problem         | Platform-specific modules via UniFFI | fetch, timers, console, crypto — same problem    | Platform-specific modules        | Platform-specific modules |
| **Debugging**              | Safari Web Inspector (iOS), logging (Android)                    | Limited — WASM debugging tools are immature on mobile | Full native debuggers                | Very limited                                     | Full native debuggers            | Full native debuggers     |
| **Ecosystem maturity**     | Mature (JSC since iOS 7, QuickJS production-proven)              | Emerging (mobile WASM runtimes are young)             | Proven (Mozilla Firefox, production) | Javy is server-side only, not mobile             | Production-ready (Google-backed) | Mature                    |
| **Team learning curve**    | Low (JS/TS is known)                                             | High (Rust)                                           | High (Rust)                          | Low (JS) but complex toolchain                   | Medium (Kotlin)                  | Medium (Swift/Kotlin)     |
| **Web browser story**      | JS runs natively                                                 | WASM runs natively                                    | WASM for web via wasm-bindgen        | WASM runs natively but adds overhead vs plain JS | Kotlin/JS possible but complex   | N/A                       |
| **App Store risk**         | None (JSC is Apple's)                                            | Low-medium (interpreter runtimes only on iOS)         | None (native code)                   | Same as WASM                                     | None                             | None                      |
| **Effort estimate**        | 8-13 weeks/platform                                              | 16-26 weeks (rewrite + 2 platforms)                   | 16-26 weeks (rewrite + UniFFI setup) | 10-15 weeks but worse than embedded JS           | 12-20 weeks                      | 16-26 weeks               |

---

## 6. WASM GC — A Critical Fragmentation Issue

WASM GC (part of Wasm 3.0, released September 2025) adds garbage-collected types to WebAssembly.
This is critical because:

- **Languages that require WASM GC:** Kotlin, Java, Dart, Scala, OCaml — these languages cannot
  compile to WASM without GC support in the host runtime
- **Languages that don't require WASM GC:** Rust, C, C++, AssemblyScript, Swift — these manage their
  own memory and work on any WASM runtime

**The fragmentation problem:**

| Runtime       | WASM GC?    | Practical impact              |
| ------------- | ----------- | ----------------------------- |
| All browsers  | Yes         | Kotlin/WASM works in browsers |
| Wasmtime v27+ | Yes         | Kotlin/WASM works             |
| WasmEdge      | Yes         | Kotlin/WASM works             |
| **Wasmer**    | **No**      | Kotlin/WASM **cannot run**    |
| **wasm3**     | **No**      | Kotlin/WASM **cannot run**    |
| **Chicory**   | **Unknown** | Likely no                     |
| **Chasm**     | **Unknown** | Likely no                     |

This means that if you wanted to write shared logic in Kotlin and compile to WASM, you'd be limited
to browser execution and a small subset of standalone runtimes. The lightweight, mobile-friendly
runtimes (wasm3, Wasmer) don't support it.

Rust and Swift-compiled WASM, by contrast, work on any runtime because they manage their own memory.

---

## 7. WASM Component Model

The [Component Model](https://component-model.bytecodealliance.org/) is a proposed standard for
composing WASM modules with rich type interfaces. It aims to solve the interop problem by defining:

- **WIT (WASM Interface Types):** A typed interface definition language
- **Canonical ABI:** Standard serialization for complex types (strings, lists, records)
- **Component composition:** Link multiple WASM components together

**Current state (2025-2026):**

- Wasmtime has the most complete implementation
- Wasmer has partial support
- Mobile runtimes (wasm3, Chicory) have limited or no support
- Still evolving — not production-stable for mobile use cases

**Relevance to us:** The Component Model would reduce the serialization boilerplate between
Swift/Kotlin and WASM, but it's not mature enough on mobile runtimes to rely on today.

---

## 8. Real-World WASM Usage on Mobile

### Figma

Figma uses WASM extensively in its **web** application (rendering engine compiled from C++ to WASM).
Their mobile apps use native code, not WASM. WASM is used for the browser, not for iOS/Android SDKs.

### Google (Chrome/V8)

Google uses WASM in Chrome for running compiled code in the browser. Their mobile SDKs (Firebase,
etc.) are native per-platform.

### Shopify

Shopify uses WASM (via Javy) for running **synchronous** merchant discount functions in a sandboxed
server-side environment. Their mobile SDKs use KMP.

### Mozilla Firefox

Uses **UniFFI** to share Rust code between iOS (Swift bindings) and Android (Kotlin bindings). This
is **native compilation, not WASM on mobile** — the same Rust + UniFFI hybrid pattern described in
section 1.

### Google Docs

Uses **Kotlin Multiplatform** (not WASM) for shared business logic across platforms.

### General pattern

**No production mobile SDK currently uses WASM for shared business logic.** The dominant
cross-platform patterns in production are KMP (Google Docs, Netflix, Cash App, Duolingo) and Rust +
UniFFI (Mozilla Firefox). WASM on mobile is used primarily for:

- Game engines (Unity WebGL → WASM in WebView)
- Server-side plugins/scripting (Shopify Functions, Fastly Compute)
- Browser-based applications (Figma, Google Earth)

---

## 9. Kotlin/WASM and SwiftWasm

### Kotlin/WASM

Kotlin/Wasm reached **Beta** as of Kotlin 2.2.20 (September 2025). It compiles Kotlin to WASM and is
used in production (Kotlin Playground, KotlinConf app). Benchmarks show Kotlin/Wasm is ~3x faster
than JavaScript in UI-heavy workloads.

**Critical limitation — WASM GC dependency:** Kotlin/Wasm **requires WASM GC** — it relies on the
host runtime's garbage collector rather than shipping its own. This means Kotlin-compiled WASM can
only run on runtimes that support WASM GC:

| Runtime                                            | WASM GC Support |
| -------------------------------------------------- | --------------- |
| All major browsers (Chrome, Firefox, Safari 18.2+) | Yes             |
| Wasmtime v27+                                      | Yes             |
| WasmEdge                                           | Yes (recent)    |
| **Wasmer**                                         | **No**          |
| **wasm3**                                          | **No**          |
| **Chicory**                                        | **Unknown**     |

This effectively means Kotlin/WASM **cannot run on most mobile-embedded runtimes today.** It's a
browser-first technology. Even if you rewrote the SDK in Kotlin and compiled to WASM, you couldn't
run it in the lightweight runtimes (wasm3, Wasmer) that are most practical for mobile SDK embedding.

### SwiftWasm

Swift officially supports WebAssembly as a **first-class compilation target** as of **Swift 6.1** —
this is now in the mainline toolchain, not a community fork.

**Current state (2026):**

- Targets: `wasm32-unknown-wasi` and `wasm32-unknown-unknown`
- BridgeJS (Swift-to-JavaScript interop) reached MVP
- WasmKit (WASM runtime written in Swift) is actively developed
- Upstream CI tests WebAssembly targets

**Could Swift WASM work for shared logic?** In theory, write business logic in Swift → compile to
WASM → run on Android (via embedded runtime) and web (via browser). However:

- Swift WASM manages its own memory (no WASM GC dependency), so it's compatible with more runtimes
- The FFI between Swift-compiled WASM and a Kotlin host requires manual memory management (pointer +
  length passing for strings, JSON serialization for complex types)
- Async/await, networking, and many Foundation APIs don't work in WASM context
- Would still require a complete rewrite from TypeScript
- Not proven for mobile SDK use cases

---

## 10. When Would WASM Make Sense?

WASM would be a strong choice if:

1. **You were starting from scratch** and willing to write core logic in Rust — Rust → WASM gives
   you a universal binary with excellent performance
2. **The business logic was compute-heavy** — WASM shines for CPU-intensive work (image processing,
   cryptography, physics). Our SDK does JSON processing and HTTP calls — not a WASM sweet spot
3. **Sandboxing was a requirement** — WASM provides strong isolation by design. Not a requirement
   for us
4. **The mobile WASM runtime ecosystem matures** — in 2-3 years, with WASI Preview 2, Component
   Model, and better mobile runtime support, the story could be much stronger

None of these conditions currently apply to our use case.

---

## 11. Conclusion

### WASM does not solve our problem better than embedded JS engines

The core issue is that **we have existing TypeScript code we want to reuse.** WASM offers two paths:

1. **JS-in-WASM (Javy/ComponentizeJS):** Runs our JS code inside QuickJS/SpiderMonkey inside WASM —
   adding a layer of indirection with no benefit over directly embedding QuickJS (which we're
   already doing on Android). Javy additionally disables the event loop, making our async SDK code
   non-functional
2. **Rewrite in Rust → WASM:** Produces a universal WASM module but requires abandoning the
   TypeScript codebase entirely — a higher investment than KMP with a less mature mobile ecosystem.
   The stronger variant (Rust + UniFFI for native mobile + WASM for web) avoids mobile WASM runtimes
   entirely but still requires a full rewrite

Both paths still require the same polyfill/bridge layer for networking, timers, and storage. Neither
eliminates the fundamental challenge of connecting JS/WASM business logic to platform-native
services.

### Where WASM fits in the landscape

```
                        Can reuse existing TS?
                        ┌─────────┬─────────┐
                        │   YES   │   NO    │
               ┌────────┼─────────┼─────────┤
  Single       │  YES   │ Embedded│ WASM    │
  source of    │        │ JS ✓    │ (Rust)  │
  truth?       ├────────┼─────────┼─────────┤
               │  NO    │  N/A    │ KMP,    │
               │        │         │ Native  │
               └────────┴─────────┴─────────┘
```

The embedded JS approach remains the only option that is both **single source of truth** and
**reuses existing TypeScript code.** WASM (Rust rewrite) achieves single source of truth but at the
cost of abandoning TypeScript. KMP and native rewrites achieve neither.

### Recommendation

**Do not pursue WASM for the native SDK project.** The embedded JS engine approach (JSC on iOS,
QuickJS on Android) remains the recommended path. WASM adds complexity without solving the problems
that embedded JS engines already handle, and requires either a full rewrite (Rust) or adds
unnecessary indirection (Javy).

If the team ever considers moving away from TypeScript as the canonical language, the **Rust +
UniFFI** hybrid (native compilation for mobile, WASM for web) is the strongest alternative — proven
by Mozilla Firefox in production. But this is a fundamentally different strategic decision from what
we're evaluating today.

WASM is worth revisiting in the future if:

- The WASI HTTP and Component Model standards mature on mobile runtimes (WASI 0.3 with native async
  is upcoming)
- A need arises for sandboxed execution of SDK logic
- The team decides to move away from TypeScript as the canonical implementation language
