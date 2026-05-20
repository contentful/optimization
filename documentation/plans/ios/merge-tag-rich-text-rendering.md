# iOS merge-tag rich-text rendering: root cause and fix plan

## Summary

The iOS demo app renders the merge-tag content entry `1MwiFl4z7gkwqGYdvCmr8c` as `No content`
instead of the resolved text
`This is a merge tag content entry that displays the visitor's continent "EU" embedded within the text.`.
The entry's `fields.text` is a Contentful **Rich Text document** (a JSON tree with
`nodeType: "document"`), not a plain string, and it contains an inline `embedded-entry-inline` node
that references an `nt_mergetag` merge-tag entry. Every iOS content view reads
`fields["text"] as? String`, which fails for a rich-text object and falls back to `"No content"`;
iOS has no rich-text flattener and no merge-tag resolution path, and the `OptimizationClient` Swift
API does not expose a merge-tag resolution method at all.

## Affected tests

- `IdentifiedVariantsTests.testShouldDisplayMergeTagContentWithResolvedValue` —
  `implementations/ios-sdk/uitests/Tests/IdentifiedVariantsTests.swift:37`
- `UnidentifiedVariantsTests.testDisplaysMergeTagContentWithResolvedValue` —
  `implementations/ios-sdk/uitests/Tests/UnidentifiedVariantsTests.swift:41`

Both assert (against `element.label`, because the label exceeds XCUITest's 128-char identifier
limit):

```
This is a merge tag content entry that displays the visitor's continent "EU" embedded within the text. [Entry: 1MwiFl4z7gkwqGYdvCmr8c]
```

## Evidence

### Test log

From `/Users/alexander.freas/.claude/jobs/78a1cd3d/swiftui-test3.log` (SwiftUI run), the
`UnidentifiedVariantsTests.testDisplaysMergeTagContentWithResolvedValue` case:

```
Test Case '-[OptimizationAppUITestsSwiftUI.UnidentifiedVariantsTests testDisplaysMergeTagContentWithResolvedValue]' started.
    t =     4.51s     Waiting 10.0s for "entry-text-1MwiFl4z7gkwqGYdvCmr8c" Other to exist
    t =     5.62s     Find the "entry-text-1MwiFl4z7gkwqGYdvCmr8c" Other
.../UnidentifiedVariantsTests.swift:48: error: -[...testDisplaysMergeTagContentWithResolvedValue] :
  XCTAssertEqual failed:
  ("No content [Entry: 1MwiFl4z7gkwqGYdvCmr8c]")
  is not equal to
  ("This is a merge tag content entry that displays the visitor's continent "EU" embedded within the text. [Entry: 1MwiFl4z7gkwqGYdvCmr8c]")
  - Expected merge tag content with resolved continent value
Test Case '-[...testDisplaysMergeTagContentWithResolvedValue]' failed (5.898 seconds).
```

The element with test ID `entry-text-1MwiFl4z7gkwqGYdvCmr8c` is found, so the view renders — its
label is `No content [Entry: 1MwiFl4z7gkwqGYdvCmr8c]`. The `[Entry: ...]` suffix proves the content
view is on screen; only the body text is the `"No content"` fallback.

### Mock-data structure of the rich-text field

`lib/mocks/src/contentful/data/entries/1MwiFl4z7gkwqGYdvCmr8c.json` (`items[0]`, content type
`mergeTagContent`). The `fields.text` is **not a string** — it is a rich-text document:

```jsonc
"text": {
  "nodeType": "document",
  "data": {},
  "content": [
    {
      "nodeType": "paragraph",
      "data": {},
      "content": [
        { "nodeType": "text", "value": "This is a merge tag content entry that displays the visitor's continent \"", "marks": [], "data": {} },
        {
          "nodeType": "embedded-entry-inline",
          "data": { "target": { "sys": { "id": "nM127uVevlpDWytfZRyum", "type": "Link", "linkType": "Entry" } } },
          "content": []
        },
        { "nodeType": "text", "value": "\" embedded within the text.", "marks": [], "data": {} }
      ]
    }
  ]
}
```

The inline node references entry `nM127uVevlpDWytfZRyum`, which is carried in `includes.Entry` of
the CDA response. That included entry has content type `nt_mergetag`:

```jsonc
{
  "sys": { "id": "nM127uVevlpDWytfZRyum", "contentType": { "sys": { "id": "nt_mergetag" } } },
  "fields": {
    "nt_name": "[Merge Tag] Continent",
    "nt_fallback": "Nowhere",
    "nt_mergetag_id": "location.continent",
  },
}
```

The expected `"EU"` comes from the visitor profile. `lib/mocks/src/experience/data/new-visitor.json`
(and `identified-visitor.json`) carries `location.continent: "EU"`, which the merge-tag id
`location.continent` selects.

## Root cause analysis

There are two distinct gaps, both of which must be closed.

### 1. iOS content views cannot read a rich-text field

All four iOS content views resolve body text with the same expression:

- `implementations/ios-sdk/swiftui/Components/ContentEntryView.swift:29` —
  `fields?["text"] as? String ?? "No content"`
- `implementations/ios-sdk/swiftui/Components/NestedContentEntryView.swift:58` —
  `fields?["text"] as? String ?? "No content"`
- `implementations/ios-sdk/uikit/Components/ContentEntryUIView.swift:40` —
  `(fields?["text"] as? String) ?? "No content"`
- `implementations/ios-sdk/uikit/Components/NestedContentEntryUIView.swift:83` —
  `(fields?["text"] as? String) ?? "No content"`

For the merge-tag entry, `fields["text"]` deserializes (via `JSONSerialization`) to a
`[String: Any]` dictionary (`nodeType: "document"`, `content: [...]`), not a `String`. The
`as? String` cast fails and the views fall back to `"No content"`. Every other home-screen entry has
a plain-string `text` field, so this is the only entry that exercises the rich-text path — which is
why this is the single merge-tag test that fails.

### 2. iOS has no merge-tag resolution and no Swift API for it

Even after a rich-text flattener walks the document tree, the `embedded-entry-inline` node must be
turned into the string `"EU"`. That requires resolving `nt_mergetag_id: "location.continent"`
against the current visitor profile. iOS has neither piece:

- There is no Swift rich-text walker anywhere in `implementations/ios-sdk` or
  `packages/ios/ContentfulOptimization`.
- `OptimizationClient`
  (`packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift`)
  exposes `identify`, `page`, `screen`, `personalizeEntry`, `getProfile`, preview-panel methods,
  etc., but **no `getMergeTagValue` equivalent**.
- The iOS JSC bridge TypeScript source `packages/ios/ios-jsc-bridge/src/index.ts` defines the
  `__bridge` object and exposes `getProfile`, `personalizeEntry`, `loadDefinitions`,
  `getPreviewState`, override methods, etc., but **does not expose `getMergeTagValue`**. (Grepping
  the compiled `optimization-ios-bridge.umd.js` for `getMergeTagValue` only matches the core SDK's
  internal `CoreBase`/`CoreStatefulEventEmitter` class methods that are bundled in — those are not
  reachable from `__bridge`.)

So the iOS SDK today **cannot** resolve a merge-tag value. The capability exists in the JS core
(`CoreBase.getMergeTagValue` → `MergeTagValueResolver.resolve`) but is not surfaced to native iOS.

### Why the included entry is already available to the view

Note one thing that is _not_ a problem: the iOS app's `ContentfulFetcher`
(`implementations/ios-sdk/shared/ContentfulFetcher.swift`) fetches each home-screen entry with
`include=10` and then `resolveLinks` / `resolveValue` recursively replaces every `Link` node with
the full included entry inline (depth-limited to 10). That means by the time the rich-text document
reaches the iOS content view, the `embedded-entry-inline` node's `data.target` has already been
expanded from a `Link` into the full `nt_mergetag` entry dictionary
(`{ sys: { contentType: { sys: { id: "nt_mergetag" } } }, fields: { nt_name, nt_fallback, nt_mergetag_id } }`).
So the merge-tag entry data is present in the Swift dictionary tree — the iOS code just never reads
the rich-text structure or resolves the merge tag.

This differs from React Native, where `App.tsx` looks the target up by id in `entry.includes.Entry`.
On iOS the target is already inlined, so the fixer can read `node["data"]["target"]` directly (and
only fall back to an `includes.Entry` lookup if the target is still a `Link`, mirroring RN's
`isLink` guard).

## Reference: how React Native does it

React Native renders this exact entry correctly. Two files matter.

### `implementations/react-native-sdk/sections/ContentEntry.tsx`

- `isRichTextField(field)` — type guard: an object with `nodeType === 'document'` and an array
  `content`. This is the detection used to branch.
- `renderContent` calls `Object.values(contentEntry.fields).find(isRichTextField)`. If a rich-text
  field is found, it computes the display string via `getRichTextContent(richTextField, sdk)`,
  builds
  `fullLabel = `${textContent} [Entry: ${baselineId}]``, and sets that as the
  `accessibilityLabel` on the wrapping `View` (test ID `entry-text-${baselineId}`). Otherwise it uses the plain-string path (`typeof
  fields.text === 'string' ? fields.text : 'No content'`).
- The visible UI uses `<RichTextRenderer richText sdk />`, but the **test assertion reads the
  `accessibilityLabel`**, which is the flattened string from `getRichTextContent`.

### `implementations/react-native-sdk/components/RichTextRenderer.tsx`

- `getRichTextContent(richText, sdk): string` — flattens the document to a plain string. It maps
  over `richText.content`, calls `extractTextContent` on each node, and joins the results with a
  single space (`.join(' ')`).
- `extractTextContent(node, sdk)`:
  - `text` node → returns `node.value`.
  - `embedded-entry-inline` node → `renderEmbeddedEntry(node, sdk)`.
  - any node with `content` → recurse into children and `.join('')`.
- `renderEmbeddedEntry(node, sdk)`:
  - `isLink(target)` guard — if the target is still an unresolved `Link`, log and return
    `[Merge Tag]`.
  - `isMergeTagEntry(includedEntry)` — checks the entry is an `nt_mergetag` entry.
  - `resolveMergeTagValue(includedEntry, sdk)` calls **`sdk.getMergeTagValue(includedEntry)`**. If
    that returns `undefined`, it falls back to `includedEntry.fields.nt_fallback` (then
    `[Merge Tag]`). Otherwise it stringifies the resolved value.
- `sdk.getMergeTagValue` ultimately runs the core `MergeTagValueResolver`
  (`packages/universal/core-sdk/src/resolvers/MergeTagValueResolver.ts`): it normalizes
  `nt_mergetag_id` into candidate dot-path selectors and resolves the first one that matches the
  current profile. For `location.continent`, `normalizeSelectors` produces the `location.continent`
  selector, which selects `"EU"` from the profile's `location.continent`.

### Resulting string

For the merge-tag entry, RN's `getRichTextContent` produces (note the `.join(' ')` over the single
top-level paragraph, and `.join('')` of the paragraph's three children):

```
This is a merge tag content entry that displays the visitor's continent "EU" embedded within the text.
```

`ContentEntry.tsx` then appends ` [Entry: 1MwiFl4z7gkwqGYdvCmr8c]` for the accessibility label —
exactly the string both iOS tests expect.

## Fix plan

The fix has three parts: (A) expose merge-tag resolution from the iOS SDK, (B) add a Swift rich-text
flattener, and (C) wire it into all four iOS content views. Part A is a dependency for B and C.

### A. Expose `getMergeTagValue` from the iOS SDK (SDK dependency)

The iOS SDK cannot resolve a merge tag today. Add the capability end to end:

1. **Bridge JS** — in `packages/ios/ios-jsc-bridge/src/index.ts`, add a `getMergeTagValue` method to
   the `__bridge` object and to its TypeScript interface (near the existing `getProfile` /
   `personalizeEntry` declarations around lines 69, 94, 448). It should accept the merge-tag entry
   (a JSON object) and call the core SDK's `getMergeTagValue` (the same `instance.getMergeTagValue`
   that `CoreStatefulEventEmitter` exposes, which defaults `profile` to the current `profileSignal`
   value). Return the resolved string, or `null`/`undefined` when unresolved, serialized the same
   way `getProfile` returns its JSON string. Rebuild the UMD bundle so
   `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Resources/optimization-ios-bridge.umd.js`
   actually exposes `__bridge.getMergeTagValue` (today the only `getMergeTagValue` occurrences in
   that bundle are internal core-class methods, not bridge methods).
2. **Swift API** — add a public method to
   `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift`,
   e.g.:

   ```swift
   /// Resolve a merge-tag entry's display value against the current profile.
   /// Returns the resolved string, or the entry's `nt_fallback` / nil when unresolved.
   public func getMergeTagValue(mergeTagEntry: [String: Any]) -> String?
   ```

   Implement it with the existing `bridgeCallSyncWhenInitialized(method:args:)` / `serializeJSON`
   plumbing, mirroring `getProfile()` / `personalizeEntry(...)`: serialize the merge-tag dictionary
   to JSON, call `__bridge.getMergeTagValue(<json>)`, and parse the string result. Resolution must
   be synchronous so the content view can build its label in `body` / `init` without an async hop.

### B. Add a Swift rich-text flattener

Create a new file, e.g. `implementations/ios-sdk/shared/RichText.swift`, with a small pure helper
enum/struct (no UI). It mirrors `RichTextRenderer.getRichTextContent` and operates on the
`[String: Any]` dictionaries the fetcher already produces:

1. `static func isRichTextDocument(_ field: Any?) -> Bool` — true when `field` is a `[String: Any]`
   with `nodeType == "document"` and an array `content`. (Mirror of RN `isRichTextField`.)
2. `static func flatten(_ document: [String: Any], client: OptimizationClient) -> String` — maps
   over the top-level `content` array, calls `extractText` on each node, and joins with a single
   space (`" "`), matching RN's `.join(' ')`.
3. `private static func extractText(_ node: [String: Any], client: OptimizationClient) -> String`:
   - `nodeType == "text"` → return `node["value"] as? String ?? ""`.
   - `nodeType == "embedded-entry-inline"` → resolve the merge tag (step 4).
   - otherwise, if `node["content"]` is an array, recurse and join children with `""` (matching RN's
     child `.join('')`).
   - default → `""`.
4. `private static func resolveEmbeddedEntry(_ node: [String: Any], client: OptimizationClient) -> String`:
   - Read `target = node["data"]["target"]` as `[String: Any]`. Because `ContentfulFetcher` already
     inlines links, `target` is normally the full `nt_mergetag` entry. Guard the still-a- `Link`
     case (`target["sys"]["type"] == "Link"`) — if so, optionally look the id up in the entry's
     `includes.Entry`, else return a fallback marker like `[Merge Tag]` (mirror RN's `isLink`
     guard).
   - Confirm it is a merge-tag entry: `target["sys"]["contentType"]["sys"]["id"] == "nt_mergetag"`
     (Swift equivalent of `isMergeTagEntry`).
   - Call `client.getMergeTagValue(mergeTagEntry: target)` (the new API from part A). If it returns
     a non-empty string, use it. Otherwise fall back to `target["fields"]["nt_fallback"] as? String`
     and then `[Merge Tag]`, matching `resolveMergeTagValue`.

Keep this as a flattener (string output) rather than a styled rich-text view: the tests assert the
`accessibilityLabel` string, and the existing content views render body text with a single `Text` /
`UILabel`. A flattened string keeps the change minimal and matches what the tests verify.

### C. Wire the flattener into the four content views

In each content view, replace the `fields["text"] as? String ?? "No content"` expression with: "if
`fields["text"]` is a rich-text document, flatten it via `RichText.flatten(_:client:)`; else if it
is a `String`, use it; else `"No content"`." The flattened/plain string then feeds the existing
visible `Text`/`UILabel` and the `accessibilityLabel` (`"\(text) [Entry: \(entryId)]"`), which is
what the tests read. The four call sites:

1. `ContentEntryView.swift` — `EntryContent.text` (line 27-30). This view already receives the SDK
   via `OptimizedEntry` / the environment; pass the `OptimizationClient` into `EntryContent` (read
   it from the environment object the same way `OptimizedEntry` does) so `text` can call the
   flattener.
2. `NestedContentEntryView.swift` — `NestedEntryText.text` (line 56-59). Same change; thread the
   client through `NestedContentItemView` → `NestedEntryText`.
3. `ContentEntryUIView.swift` — `EntryContentView.init` (line 39-40). The `client` is already in
   scope in the enclosing `ContentEntryUIView.init`; pass it into `EntryContentView`.
4. `NestedContentEntryUIView.swift` — `NestedEntryText.init` (line 82-83). `client` is already
   threaded through `NestedContentItemUIView`; pass it into `NestedEntryText`.

Because the merge-tag entry is a flat (non-nested) home-screen entry rendered via `ContentEntryView`
/ `ContentEntryUIView` (see `MainScreen.swift:55`), the nested variants are not strictly required by
the two failing tests — but they share the identical bug and the same `"No content"` fallback, so
fixing all four keeps the views consistent and avoids a latent failure if a nested rich-text entry
is ever added.

### Validation

- Build the iOS SDK package and rebuild the UMD bridge bundle after the part-A change.
- Run both UI test targets' merge-tag cases (SwiftUI and UIKit schemes):
  `IdentifiedVariantsTests.testShouldDisplayMergeTagContentWithResolvedValue` and
  `UnidentifiedVariantsTests.testDisplaysMergeTagContentWithResolvedValue`.
- Confirm `entry-text-1MwiFl4z7gkwqGYdvCmr8c`'s label equals the expected resolved string in both
  the identified and unidentified flows (both profiles carry `location.continent: "EU"`).

## Risks and open questions

- **SDK API surface change.** Part A adds a new public method to the published iOS SDK
  (`OptimizationClient.getMergeTagValue`) and a new `__bridge` method. This widens the SDK's public
  contract and requires rebuilding the committed UMD bundle. Per repo convention (keep Swift thin,
  push logic into JS), the resolution itself must live in the bridge/core, not in Swift. Confirm
  whether a public Swift API is desired or whether the demo app should call a more internal hook.
- **Synchronous resolution.** `getMergeTagValue` must be synchronous so content views can build
  their label without an async render hop. `personalizeEntry` and `getProfile` are already
  synchronous (`bridgeCallSyncWhenInitialized` / `bridge.callSync`), so the pattern exists, but
  confirm the merge-tag path does not need to await any signal hydration.
- **Profile timing.** The resolved value depends on the current profile signal. The home-screen
  `OptimizedEntry` instances lock on their first resolved value; verify the profile is populated
  before the merge-tag view computes its label, otherwise it would resolve to the `nt_fallback`
  (`"Nowhere"`) instead of `"EU"`. The RN flow resolves in a `useEffect` keyed on `profile`, so it
  re-resolves once the profile arrives — the Swift views may need to recompute when the SDK profile
  updates (SwiftUI: the `OptimizationClient` `@Published state`; UIKit: an explicit refresh).
- **`includes.Entry` shape after fetch.** This plan relies on `ContentfulFetcher.resolveLinks`
  having already inlined the `embedded-entry-inline` target. If the SDK's `personalizeEntry`
  round-trip ever re-serializes the entry and drops the inlined target back to a `Link`, the
  flattener's `isLink` fallback path would trigger; confirm the resolved entry passed to the content
  view still carries the inlined `nt_mergetag` entry.
- **String join spacing.** RN joins top-level nodes with a single space and paragraph children with
  the empty string. The Swift flattener must replicate this exactly (`" "` between top-level nodes,
  `""` between children) or the label will not byte-match the expected string.
- **128-char identifier limit.** The tests deliberately assert against `element.label` rather than a
  label subscript because the string exceeds XCUITest's 128-char identifier limit. The fix must keep
  the resolved string on `accessibilityLabel`, not on `accessibilityIdentifier`.

## Related files

- `lib/mocks/src/contentful/data/entries/1MwiFl4z7gkwqGYdvCmr8c.json` — merge-tag entry (rich-text
  `fields.text`, `nt_mergetag` in `includes.Entry`).
- `lib/mocks/src/experience/data/new-visitor.json`,
  `lib/mocks/src/experience/data/identified-visitor.json` — profiles carrying
  `location.continent: "EU"`.
- `implementations/ios-sdk/swiftui/Components/ContentEntryView.swift`
- `implementations/ios-sdk/swiftui/Components/NestedContentEntryView.swift`
- `implementations/ios-sdk/uikit/Components/ContentEntryUIView.swift`
- `implementations/ios-sdk/uikit/Components/NestedContentEntryUIView.swift`
- `implementations/ios-sdk/shared/ContentfulFetcher.swift` — inlines linked entries before render.
- `implementations/ios-sdk/swiftui/Screens/MainScreen.swift` — uses `ContentEntryView`.
- `implementations/ios-sdk/uitests/Tests/IdentifiedVariantsTests.swift`
- `implementations/ios-sdk/uitests/Tests/UnidentifiedVariantsTests.swift`
- `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift`
  — Swift SDK public API (no merge-tag method today).
- `packages/ios/ios-jsc-bridge/src/index.ts` — iOS `__bridge` definition (no `getMergeTagValue`).
- `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Resources/optimization-ios-bridge.umd.js`
  — compiled bridge bundle (must be rebuilt after the bridge change).
- `implementations/react-native-sdk/components/RichTextRenderer.tsx` — reference flattener/renderer.
- `implementations/react-native-sdk/sections/ContentEntry.tsx` — reference rich-text detection.
- `packages/universal/core-sdk/src/resolvers/MergeTagValueResolver.ts` — core merge-tag resolution.
- `packages/universal/core-sdk/src/CoreBase.ts`,
  `packages/universal/core-sdk/src/CoreStatefulEventEmitter.ts` — `getMergeTagValue` in JS core.
- `implementations/react-native-sdk/e2e/displays-identified-user-variants-pseudocode.md`,
  `implementations/react-native-sdk/e2e/displays-unidentified-user-variants-pseudocode.md` —
  cross-platform test contract.
