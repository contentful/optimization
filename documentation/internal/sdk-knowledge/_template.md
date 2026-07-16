<!--
Canonical per-SDK template. Copy this file into the right family dir (e.g. web/) and fill each
section with VERIFIED facts + source pointers. Keep every heading, in this order. If a section has
no entries for this SDK, keep the heading and write "None." Terse notes, not prose. Link to
shared/concepts.md and shared/vocabulary.md instead of restating shared material.
-->

# <SDK display name> — SDK knowledge

<!-- feeds-guides: documentation/guides/<the guide this file's facts compose into>.md -->

> Internal, verified reference. Not a guide. Facts only, each with a source pointer verified against
> packages/\*\*/src.

Shared vocabulary and SDK-neutral concepts: see [`../shared/vocabulary.md`](../shared/vocabulary.md)
and [`../shared/concepts.md`](../shared/concepts.md). This file records only what is specific to
this SDK.

## Package & entry points

Keep only the documentation-relevant public symbol/import index. Do not copy signatures, props, or
return shapes; the types own those.

| Import path | Public symbol or purpose | source |
| ----------- | ------------------------ | ------ |

## Setup / initialization and binding

- Record behavioral setup facts: lifecycle, defaults, ownership, initialization timing, and setup
  helper semantics. For exact config keys and returns, point the writer to the symbol and let it
  read the types. source: per line.

## Components & hooks

Keep only a navigation index. Behavioral lifecycle facts belong as sourced bullets below the table.

| Name | Kind | Import path | source |
| ---- | ---- | ----------- | ------ |

## Render / entry resolution

- Behavioral resolution/fallback/mutation semantics and the integration consequence. Read the exact
  render type from the types. source:

## Identifier ownership

| Identifier (cookie/header/storage/env) | Owner: SDK or reader | Notes | source |
| -------------------------------------- | -------------------- | ----- | ------ |

## Events & tracking

- Page/route/screen events, interaction tracking: how emitted, dedup/skip semantics, consent gating.
  source: per line.

## Consent & persistence

- consent vs persistence model, where consent policy is read, default behavior. source:

## Version / runtime quirks

- Filename/handler conventions, framework-version differences, SSR/caching/dynamic-render
  interactions. source:

## Failure & fallback behavior

- What happens on API failure, missing variant, unresolved links, bad payload shape. source:
