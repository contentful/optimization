# Phase 7: Preview Panel and Polish

## Goal

Implement the debug preview panel, persistent storage (UserDefaults), and build/CI scripts.

## Context from Prior Phases

### Phase 1 (Completed)

Swift Package at `packages/ios/ContentfulOptimization/`.

### Phases 2-4 (Expected)

Full SDK API, SwiftUI components, lifecycle handlers, network monitoring.

### Phase 5-6 (Expected)

Implementation app at `implementations/ios-sdk/` with XCUITest suite passing.

---

## Part 1: Preview Panel

### Files to Create

```
Sources/ContentfulOptimization/
  Preview/
    PreviewPanelOverlay.swift
    PreviewPanelContent.swift
```

### JS Bridge Extensions

Add to `packages/ios/ios-jsc-bridge/src/index.ts`:

```typescript
interface Bridge {
  // ...existing methods...

  // NEW — preview panel
  setPreviewPanelOpen(open: boolean): void
  overrideAudience(audienceId: string, qualified: boolean): void
  overrideVariant(experienceId: string, variantIndex: number): void
  getPreviewState(): string // Returns JSON with audiences, experiences, overrides
}
```

Implementation: These map directly to `CoreStateful` preview methods. Check the core SDK for exact
method signatures.

### `PreviewPanelOverlay.swift`

A floating action button (FAB) that opens a sheet overlay with the preview panel content.

```swift
import SwiftUI

public struct PreviewPanelOverlay<Content: View>: View {
    @ViewBuilder let content: () -> Content
    @State private var isOpen = false
    @EnvironmentObject private var client: OptimizationClient

    public var body: some View {
        ZStack(alignment: .bottomTrailing) {
            content()

            // FAB button
            Button(action: { isOpen.toggle() }) {
                Image(systemName: "gear")
                    .padding()
                    .background(Circle().fill(Color.blue))
                    .foregroundColor(.white)
            }
            .padding()
            .sheet(isPresented: $isOpen) {
                PreviewPanelContent()
                    .environmentObject(client)
            }
        }
        .onChange(of: isOpen) { newValue in
            client.setPreviewPanelOpen(newValue)
        }
    }
}
```

### `PreviewPanelContent.swift`

Displays current profile, audiences (with qualification toggle), and personalizations (with variant
override).

**Reference**: `packages/web-sdk/src/preview/` or `packages/react-native-sdk/src/preview/` for the
preview panel patterns.

Sections:

1. **Profile** — display current profile JSON
2. **Audiences** — list all audiences with toggle switches to override qualification
3. **Experiences/Personalizations** — list active experiences with variant picker
4. **Debug** — toggle debug logging

Each audience row:

```swift
Toggle(audience.name, isOn: Binding(
    get: { audience.isQualified },
    set: { client.overrideAudience(id: audience.id, qualified: $0) }
))
```

---

## Part 2: Persistent Storage

### Files to Create

```
Sources/ContentfulOptimization/
  Storage/
    PersistentStore.swift
    UserDefaultsStore.swift
```

### `PersistentStore.swift`

Protocol for storage abstraction:

```swift
protocol PersistentStore {
    var profile: [String: Any]? { get set }
    var consent: Bool? { get set }
    var changes: [String: Any]? { get set }
    var personalizations: [[String: Any]]? { get set }
    var anonymousId: String? { get set }
    var debug: Bool { get set }

    func load()
    func clear()
}
```

### `UserDefaultsStore.swift`

**Reference**: `packages/react-native-sdk/src/storage/AsyncStorageStore.ts`

The RN SDK uses AsyncStorage to persist state across app launches. The iOS equivalent uses
UserDefaults with a suite name to avoid key collisions.

```swift
final class UserDefaultsStore: PersistentStore {
    private let defaults: UserDefaults
    private let keyPrefix = "com.contentful.optimization."

    // In-memory cache for fast reads
    private var cache: [String: Any] = [:]

    init(suiteName: String = "com.contentful.optimization") {
        self.defaults = UserDefaults(suiteName: suiteName) ?? .standard
    }

    func load() {
        // Load all keys from UserDefaults into cache
    }

    func clear() {
        // Remove all prefixed keys
    }

    // Each property reads from cache, writes through to UserDefaults
    var profile: [String: Any]? {
        get { cache["profile"] as? [String: Any] }
        set {
            cache["profile"] = newValue
            if let data = newValue.flatMap({ try? JSONSerialization.data(withJSONObject: $0) }) {
                defaults.set(data, forKey: keyPrefix + "profile")
            } else {
                defaults.removeObject(forKey: keyPrefix + "profile")
            }
        }
    }
    // ...similar for consent, changes, personalizations, anonymousId, debug
}
```

### Integration with OptimizationClient

1. Load store at init time
2. Pass stored defaults to bridge config (so the JS SDK initializes with persisted state)
3. On `__nativeOnStateChange`, write through to store
4. On `destroy()` or `reset()`, clear relevant keys

Update `OptimizationConfig` to accept defaults:

```swift
public struct OptimizationConfig {
    // ...existing...
    public var defaults: StorageDefaults?
}

public struct StorageDefaults {
    public var consent: Bool?
    public var profile: [String: Any]?
    public var changes: [String: Any]?
    public var personalizations: [[String: Any]]?
}
```

Update the JS bridge `BridgeConfig` to accept defaults:

```typescript
interface BridgeConfig {
  clientId: string
  environment: string
  experienceBaseUrl?: string
  insightsBaseUrl?: string
  defaults?: {
    consent?: boolean
    profile?: unknown
    changes?: unknown
    personalizations?: unknown
  }
}
```

---

## Part 3: Build Scripts

### `scripts/build-ios-sdk.sh`

End-to-end build script:

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BRIDGE_DIR="$ROOT_DIR/packages/ios/ios-jsc-bridge"
PACKAGE_DIR="$ROOT_DIR/packages/ios/ContentfulOptimization"
RESOURCES_DIR="$PACKAGE_DIR/Sources/ContentfulOptimization/Resources"

echo "=== Building JS Bridge ==="
cd "$BRIDGE_DIR"
pnpm build

echo "=== Copying UMD bundle to Swift Package resources ==="
cp "$BRIDGE_DIR/dist/optimization-ios-bridge.umd.js" "$RESOURCES_DIR/"

echo "=== Building Swift Package ==="
cd "$PACKAGE_DIR"
swift build

echo "=== Running Swift Package tests ==="
swift test

echo "=== Build complete ==="
```

### pnpm script in `ios-jsc-bridge/package.json`

Add a postbuild hook to auto-copy the UMD bundle:

```json
{
  "scripts": {
    "build": "pnpm clean && pnpm build:dist",
    "build:dist": "rslib build",
    "postbuild": "cp dist/optimization-ios-bridge.umd.js ../ContentfulOptimization/Sources/ContentfulOptimization/Resources/"
  }
}
```

### CI integration

Add to the CI pipeline (if applicable):

```yaml
- name: Build iOS SDK
  run: scripts/build-ios-sdk.sh

- name: Run iOS UI Tests
  run: |
    cd implementations/ios-sdk
    xcodebuild test \
      -project OptimizationApp.xcodeproj \
      -scheme OptimizationApp \
      -destination 'platform=iOS Simulator,name=iPhone 15,OS=17.2'
```

---

## Verification

### Preview Panel

- FAB button appears overlaid on app content
- Tapping opens sheet with current state
- Audience toggles trigger live variant updates in PersonalizationViews
- Variant overrides display correct content immediately
- Closing panel reverts to real state

### Persistent Storage

- `identify` → kill app → relaunch → profile is restored
- `consent(true)` → kill app → relaunch → consent is still true
- `reset()` → kill app → relaunch → storage is cleared
- `destroy()` → storage keys are removed

### Build Scripts

- `scripts/build-ios-sdk.sh` runs end-to-end without errors
- `pnpm build` in `ios-jsc-bridge` auto-copies bundle to resources
- CI script completes successfully

---

## Phase Dependency Note

Phase 7 can start after Phase 3 is complete (needs SwiftUI components for preview panel). It does
not depend on Phases 5-6 (implementation app / tests), though the preview panel should be tested in
the implementation app once it exists.

---

## Reference Files

- **RN AsyncStorage**: `packages/react-native-sdk/src/storage/AsyncStorageStore.ts` — storage
  patterns
- **RN ContentfulOptimization**: `packages/react-native-sdk/src/ContentfulOptimization.ts` — how
  storage is wired to effects
- **Web preview panel**: `packages/web-sdk/src/preview/` — preview panel implementation
- **Core preview methods**: Check `CoreStateful` for `setPreviewPanelOpen`, audience/variant
  override APIs
- **Current bridge**: `packages/ios/ios-jsc-bridge/src/index.ts`
- **Current build config**: `packages/ios/ios-jsc-bridge/rslib.config.ts`, `package.json`
