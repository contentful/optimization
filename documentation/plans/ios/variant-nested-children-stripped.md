# Variant nested children stripped by ContentfulFetcher depth cap

## Summary

The iOS demo app's `ContentfulFetcher.resolveLinks` recursive link resolver has a `depth < 10` cap
that is exhausted _before_ it reaches the `nested` array of an entry that lives inside the
`nt_experiences` → `nt_variants` chain. As a result, the level-0 variant entry
`2KIWllNZJT205BwOSkMINg` is returned with its `fields.nested[0]` left as an unresolved `{sys: Link}`
stub (no `fields`). When `NestedContentEntryView` recurses into that stub it has no `fields.text`
and no `fields.nt_experiences`, so level 1 (`5i4SdJXw9oDEY0vgO7CwF4`) renders "No content" and never
personalizes to its variant `5a8ONfBdanJtlJ39WWnH1w`, and level 2 never appears at all. The bug is
entirely in the iOS app shell's fetcher; the JS bridge, the JS core resolver, and the mock data are
all correct.

## Affected tests

All twelve failures share the same missing element (`entry-text-5a8ONfBdanJtlJ39WWnH1w`, the level-1
nested variant):

- `implementations/ios-sdk/uitests/Tests/PreviewPanelOverridesTests.swift` — all 8 scenarios. Their
  shared `identifyAndRelaunch` helper waits for `entry-text-5a8ONfBdanJtlJ39WWnH1w`.
- `implementations/ios-sdk/uitests/Tests/IdentifiedVariantsTests.swift`
  - `testShouldDisplayLevel1NestedVariantForReturnVisitors`
  - `testShouldDisplayLevel2NestedVariantForReturnVisitors`
- `implementations/ios-sdk/uitests/Tests/UnidentifiedVariantsTests.swift`
  - `testDisplaysLevel1NestedBaselineForNewVisitors`
  - `testDisplaysLevel2NestedBaselineForNewVisitors` (both assert the baseline, then
    identify-and-relaunch and assert the nested variant)

## Evidence

### Test log

Log: `/Users/alexander.freas/.claude/jobs/78a1cd3d/swiftui-test3.log`

`testShouldDisplayLevel1NestedVariantForReturnVisitors` fails because the level-1 variant element is
never created. The accessibility-hierarchy dump shows the level-1 entry stayed at its baseline id
with empty text:

```
line 1466: error: ... Failed to get matching snapshot: No matches found for
           Elements matching predicate '"entry-text-5a8ONfBdanJtlJ39WWnH1w" IN identifiers'
line 1491:   Other, identifier: 'content-entry-5i4SdJXw9oDEY0vgO7CwF4',
line 1501:   Other, identifier: 'entry-text-5i4SdJXw9oDEY0vgO7CwF4',
             label: 'No content [Entry: 5i4SdJXw9oDEY0vgO7CwF4]'
```

`5i4S` is reached here through the resolved level-0 variant `2KIW`, and it has **no** `fields.text`
("No content") and **no** `fields.nt_experiences` (it never re-personalizes). It also has no
children, so level 2 is absent.

By contrast, when the _same_ `5i4S` entry is reached through the unidentified baseline `1JAU` it
renders fully:

```
line 2857:   Other, identifier: 'entry-text-5i4SdJXw9oDEY0vgO7CwF4',
             label: 'This is a level 1 nested baseline entry. [Entry: 5i4SdJXw9oDEY0vgO7CwF4]'
```

So the difference is entirely about _how the entry was reached_: through the plain `nested` chain
(works) vs. through the `nt_experiences`/`nt_variants` chain (children stripped).

### The depth cap

`implementations/ios-sdk/shared/ContentfulFetcher.swift:57-58`

```swift
private static func resolveValue(_ value: Any, lookup: [String: [String: Any]], depth: Int = 0) -> Any {
    guard depth < 10 else { return value }
```

`depth` is incremented on _every_ recursion step — into dicts, into arrays, and when following a
`Link` (lines 66, 71, 75). It is not a logical link-hop counter; it counts every node of the JSON
tree.

### Depth trace to the lost array

`ContentfulFetcher.fetchEntry(id:)` requests `1JAU028vQ7v6nB2swl3NBo` with `include=10`. The mock
returns the whole `1JAU028vQ7v6nB2swl3NBo.json` file (see "Root cause analysis" for why the mock
data is complete). `resolveLinks` builds a flat lookup from `includes.Entry` and calls
`resolveValue(1JAU_item, depth: 0)`.

Path to the level-0 variant's `nested` array (the one that ends up stripped):

| depth | node                                                                                  |
| ----- | ------------------------------------------------------------------------------------- |
| 0     | `1JAU` entry dict                                                                     |
| 1     | `1JAU.fields` dict                                                                    |
| 2     | `1JAU.fields.nt_experiences` array                                                    |
| 3     | `nt_experiences[0]` Link → follow to `1FHhEY0xkcCC9R5WCmnjRr`                         |
| 4     | `1FHhEY...` entry dict                                                                |
| 5     | `1FHhEY.fields` dict                                                                  |
| 6     | `1FHhEY.fields.nt_variants` array                                                     |
| 7     | `nt_variants[0]` Link → follow to `2KIWllNZJT205BwOSkMINg`                            |
| 8     | `2KIW` entry dict                                                                     |
| 9     | `2KIW.fields` dict                                                                    |
| 10    | `2KIW.fields.nested` array → **`guard depth < 10` fails — array returned unresolved** |

At depth 10 the array `[ {sys: {type: "Link", id: "5i4SdJXw9oDEY0vgO7CwF4"}} ]` is returned
verbatim. The `Link` inside is never swapped for the full `5i4S` entry, so the variant `2KIW` that
the JS core later hands back has a shallow `nested` child.

For comparison, the baseline path reaches `5i4S` well within budget: depth 0 `1JAU` → 1 `fields` → 2
`nested` array → 3 Link → **4 `5i4S` resolved** → 5 `fields` → 6 `nested` → 7 Link → 8 `uaNY`
resolved. Everything is under 10, so the unidentified baseline tree renders fully — exactly what the
log shows.

## Root cause analysis

The children are lost in **candidate (b): `ContentfulFetcher.resolveLinks` does not resolve links
inside `nt_experiences` deeply enough.** Specifically, its `resolveValue` depth guard is exhausted
before it reaches `nested` arrays that sit under the `nt_experiences` → `nt_variants` subtree.

The other candidates are ruled out:

- **(a) mock CDA `includes` too shallow — ruled out.** The mock route
  `lib/mocks/src/contentful-handlers.ts:115-125` (`handleEntryIdQuery`) serves the requested
  `<id>.json` file _verbatim_, regardless of the `include` parameter.
  `lib/mocks/src/contentful/data/entries/1JAU028vQ7v6nB2swl3NBo.json` already contains, in
  `includes.Entry`, every entry in the full tree: the `nt_experience` configs `1FHhEY...`,
  `7DyidZaPB7Jr1gWKjoogg0`, `6IueRX1pS3iMJncbhUQTba`; the variant entries `2KIW`,
  `5a8ONfBdanJtlJ39WWnH1w`, `4hDiXxYEFrXHXcQgmdL9Uv`; and the baseline children `5i4S` and
  `uaNY4YJ0HFPAX3gKXiRdX`. The data is complete.

- **(c) JS-bridge `personalizeEntry` returns a shallow variant — ruled out.**
  `packages/ios/ios-jsc-bridge/src/index.ts:312-322` simply forwards the baseline to
  `instance.ln(...)` and `JSON.stringify`s the result. It performs no link resolution and no
  pruning. It can only return whatever children the _input_ entry already carried.

- **(d) the variant entry genuinely only has shallow `nested` — ruled out.** In the mock data,
  `2KIW`'s `fields.nested` is a normal `Link` to `5i4S` (`2KIWllNZJT205BwOSkMINg.json` items[0], and
  the same link in `1JAU`'s includes). `5i4S` itself carries full `text`, `nested`, and
  `nt_experiences`. The variant is fully personalizable _if its links are resolved_.

The JS core resolver confirms the variant comes straight from the input tree.
`OptimizedEntryResolver.getSelectedVariantEntry`
(`packages/universal/core-sdk/src/resolvers/OptimizedEntryResolver.ts:331-356`) returns the variant
entry by looking it up inside `optimizationEntry.fields.nt_variants` — i.e. it returns whatever
object the iOS app put there. If `ContentfulFetcher` left `2KIW.fields.nested` as a Link stub, the
core returns `2KIW` with that same stub; the core does not (and cannot) fetch or expand Contentful
links.

Net effect on the iOS render path:

1. `OptimizedEntry.swift:61-64` (`isPersonalized`) keys off `fields.nt_experiences`. The level-0
   baseline `1JAU` has it, so the level-0 `OptimizedEntry` calls `personalizeEntry` and the
   identified profile resolves it to `2KIW`.
2. `NestedContentEntryView` /
   `implementations/ios-sdk/swiftui/Components/NestedContentEntryView.swift:28-35` reads children
   from `resolvedEntry.fields.nested`. For `2KIW` that array contains only the `5i4S` Link stub —
   but it _does_ have a `sys.id`, so the `nestedEntries` filter keeps it and recurses.
3. The recursed `NestedContentEntryView` wraps the `5i4S` stub in an `OptimizedEntry`. Because the
   stub has no `fields.nt_experiences`, `isPersonalized` is `false`, so `personalizeEntry` is never
   called — `5i4S` can never become `5a8O`.
4. `NestedEntryText` (`NestedContentEntryView.swift:56-59`) reads `fields.text`; the stub has no
   `fields`, so it renders the `"No content"` fallback. Its `nested` is also absent, so level 2
   never renders.

## Reference: how React Native does it correctly

`implementations/react-native-sdk/sections/NestedContentItem.tsx` is structurally identical to the
iOS component — it reads children from `resolvedEntry.fields.nested` and wraps each child in its own
`OptimizedEntry`. The component is not where RN differs.

The difference is the **fetch layer**. RN does not hand-roll link resolution.
`implementations/react-native-sdk/utils/sdkHelpers.ts:14-44` uses the official `contentful` JS
client:

```ts
const INCLUDE_DEPTH = 10
// ...
const entry = await contentfulClient.getEntry(entryId, { include: INCLUDE_DEPTH })
```

The `contentful` client's built-in link resolver walks the entire `includes` graph and resolves
_every_ link it can reach, with no per-node JSON-tree depth counter — `include` is a server-side
query parameter, not a client-side traversal cap. So in RN the variant entry inside `nt_variants`
arrives with its `nested` children fully expanded, the recursed `OptimizedEntry` sees
`nt_experiences`, and levels 1 and 2 personalize correctly.

iOS reimplemented this resolution by hand in `ContentfulFetcher` and the hand-rolled `depth < 10`
guard is the regression.

## Fix plan

The fix belongs in the **iOS app shell** — `implementations/ios-sdk/shared/ContentfulFetcher.swift`.
Do not change the JS bridge, the JS core, or the mock data; they are correct.

1. **Change the depth guard so it counts logical link hops, not JSON-tree nodes.** In `resolveValue`
   (`ContentfulFetcher.swift:57-79`), only increment `depth` when a `Link` is actually followed (the
   recursion at line 66), and pass `depth` unchanged when descending into a plain dict or array
   (lines 71 and 75). A link-hop budget of 10 then matches the `include=10` contract and the RN
   behavior. The level-0 → level-1 → level-2 tree is only ~6 link hops deep through the
   `nt_experiences` chain, comfortably within budget.

2. **Alternatively, or additionally, guard against infinite cycles instead of capping depth.** Track
   the set of entry ids currently being resolved on the active path and skip re-resolving a `Link`
   whose target id is already on that path. This removes the arbitrary numeric cap entirely while
   still preventing stack overflow on cyclic content graphs. If this approach is taken, the numeric
   `depth` parameter can be dropped.

3. **Verify the resolver still terminates.** The mock content graph has shared children (`5i4S`,
   `uaNY` appear under multiple parents) but those are a DAG, not a true cycle, so option 1 alone is
   sufficient; option 2 is the more robust long-term choice.

4. **Re-run the iOS XCUITest suite** (`PreviewPanelOverridesTests`, `IdentifiedVariantsTests`,
   `UnidentifiedVariantsTests`) for both the SwiftUI and UIKit hosts. The UIKit renderer
   (`implementations/ios-sdk/uikit/Components/NestedContentEntryUIView.swift`) shares the same
   `ContentfulFetcher`, so it is fixed by the same change — no per-host edit is needed.

5. **No SDK package change required.** `OptimizedEntry.swift`'s `isPersonalized` check (keyed on
   `fields.nt_experiences`) is correct _given_ a fully-resolved entry; once the fetcher returns full
   children it will behave correctly.

## Risks and open questions

- **Confirm `depth` is purely a tree-node counter today.** Reading `ContentfulFetcher.swift:57-79`,
  `depth + 1` is passed on lines 66 (link follow), 71 (dict descent) and 75 (array descent). The
  trace above assumes every step counts; this is consistent with the code as written, but re-verify
  before editing.
- **`fetchEntry` requests `include=10` per entry** (line 16). The mock ignores the parameter and
  returns the whole file, so raising the client-side budget is safe against the mock. Against a
  _real_ Contentful CDA, `include` is capped at 10 by the server; the hand-rolled resolver can never
  resolve links the server did not include. The demo's deepest tree fits within `include=10`, so
  this is not a concern for the affected tests, but note it if the content tree grows.
- **Shared/cyclic references.** `5i4S` and `uaNY` are referenced from multiple parents. Option 1
  (link-hop counter) re-resolves them on each path, which is fine for a DAG. If the content model
  ever introduces a true cycle, option 2 (visited-set) is required to avoid non-termination.
- **After fixing, re-check the level-2 entry.** Level 2's variant is `4hDiXxYEFrXHXcQgmdL9Uv` and
  its baseline is `uaNY4YJ0HFPAX3gKXiRdX`. Confirm the XCUITest hierarchy dump shows
  `entry-text-4hDiXxYEFrXHXcQgmdL9Uv` for identified users and `entry-text-uaNY4YJ0HFPAX3gKXiRdX`
  with full text for unidentified users.
- **`isPersonalized` and resolved-vs-baseline `nt_experiences`.** The recursed `OptimizedEntry` for
  level 1 must see `fields.nt_experiences` on the resolved `5i4S` entry to personalize it. The mock
  `5i4S` carries `nt_experiences` (`7DyidZaPB7Jr1gWKjoogg0`), so once the fetcher resolves the
  `2KIW → 5i4S` link the recursion works. Verify the resolved `5i4S` retains its `nt_experiences`
  after the fetcher fix (it will, since that array is just another set of links the deeper budget
  now reaches).

## Related files

- `implementations/ios-sdk/shared/ContentfulFetcher.swift` — the buggy resolver (`resolveValue`,
  line 57; depth guard, line 58)
- `implementations/ios-sdk/shared/Config.swift` — `entryIds` list; `1JAU028vQ7v6nB2swl3NBo` is the
  level-0 baseline
- `implementations/ios-sdk/swiftui/Components/NestedContentEntryView.swift` — SwiftUI nested
  renderer
- `implementations/ios-sdk/uikit/Components/NestedContentEntryUIView.swift` — UIKit nested renderer
  (same fetcher)
- `implementations/ios-sdk/swiftui/Screens/MainScreen.swift` — calls
  `ContentfulFetcher.fetchEntries`
- `implementations/ios-sdk/uikit/Screens/MainViewController.swift` — calls
  `ContentfulFetcher.fetchEntries`
- `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Views/OptimizedEntry.swift` —
  `isPersonalized` keyed on `fields.nt_experiences` (lines 61-64)
- `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Core/OptimizationClient.swift`
  — `personalizeEntry` (line 189)
- `packages/ios/ContentfulOptimization/Sources/ContentfulOptimization/Bridge/JSContextManager.swift`
  — JS bridge (no link resolution, no pruning)
- `packages/ios/ios-jsc-bridge/src/index.ts` — `personalizeEntry` forwards to `instance.ln` (lines
  312-322)
- `packages/universal/core-sdk/src/CoreBase.ts` — `resolveOptimizedEntry`/`ln` (lines 156-177)
- `packages/universal/core-sdk/src/resolvers/OptimizedEntryResolver.ts` — `getSelectedVariantEntry`
  returns the variant from `nt_variants` (lines 331-356)
- `lib/mocks/src/contentful-handlers.ts` — mock CDA serves whole `<id>.json` files (lines 115-125)
- `lib/mocks/src/contentful/data/entries/1JAU028vQ7v6nB2swl3NBo.json` — complete level-0 baseline
  tree (includes every nested entry)
- `lib/mocks/src/contentful/data/entries/2KIWllNZJT205BwOSkMINg.json` — level-0 variant
- `lib/mocks/src/contentful/data/entries/5i4SdJXw9oDEY0vgO7CwF4.json` — level-1 baseline
- `implementations/react-native-sdk/utils/sdkHelpers.ts` — RN fetch via official `contentful` client
  (`include: 10`)
- `implementations/react-native-sdk/sections/NestedContentItem.tsx` — RN nested renderer (works
  correctly)
- Test log: `/Users/alexander.freas/.claude/jobs/78a1cd3d/swiftui-test3.log`
