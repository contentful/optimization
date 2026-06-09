---
title: Experience request state
---

# Experience request state

Use this document to understand how the Optimization SDK Suite reports the outcome of the most
recent Experience API request, and why consumers should react to that outcome instead of waiting
indefinitely for optimization data. It explains the state machine, the transitions, the contract
each platform implementation must honor, and the cases this signal does and does not cover.

For the broader signal catalog and how `states` is exposed, see
[Core state management](./core-state-management.md). For installation and setup, see
[Integrating the React web SDK in a React app](../guides/integrating-the-react-web-sdk-in-a-react-app.md).

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Why this signal exists](#why-this-signal-exists)
- [The state machine](#the-state-machine)
- [Transition rules](#transition-rules)
- [What this signal covers](#what-this-signal-covers)
- [What this signal does not cover](#what-this-signal-does-not-cover)
- [Consumer pattern](#consumer-pattern)
- [Cross-platform contract](#cross-platform-contract)

<!-- mtoc-end -->
</details>

## Why this signal exists

The `OptimizedEntry` component, and any other consumer that gates rendering on optimization data,
needs to know when the Experience API request that should produce that data has succeeded or failed.
Without that signal, a consumer that is waiting for `selectedOptimizations` has no way to
distinguish "still loading" from "the request already failed and no more data is coming". A failed
request that is silently retained as `loading` results in regions of the page that never resolve to
either a variant or the baseline.

`experienceRequestState` reports the outcome explicitly so consumers can fail-open to baseline
content when the API cannot resolve optimization data.

## The state machine

`experienceRequestState` is a writable signal exposed read-only on `CoreStateful.states`. Its value
is one of:

| State                                       | Meaning                                                                                |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `{ status: 'idle' }`                        | No Experience API request has been attempted in this runtime.                          |
| `{ status: 'pending' }`                     | An Experience API request is in flight.                                                |
| `{ status: 'success' }`                     | The most recent request returned data and the output signals have been updated.        |
| `{ status: 'failed', reason: 'timeout' }`   | The most recent request was aborted by the configured request timeout.                 |
| `{ status: 'failed', reason: 'api-error' }` | The most recent request returned a non-success HTTP status or an unparseable response. |
| `{ status: 'failed', reason: 'aborted' }`   | Reserved for explicit-cancellation paths added in future work.                         |

The `failed` state carries a `reason` so consumers and telemetry can distinguish network outages
from API errors. The set of reasons is closed; new reasons are additive on this signal rather than
introduced as separate signals.

In the current TypeScript runtime, the api-client's retry layer rethrows aborted requests as a
generic `Error`, which loses the original `AbortError` identity. That means the queue cannot
distinguish a timeout from a non-success HTTP response and reports both as `failed:api-error`. The
`timeout` reason is retained in the public type so a future api-client change that preserves error
identity, or any platform that does not wrap fetch in the same retry layer, can emit it without a
breaking change. Treat the reason as a hint, not a guarantee, until the api-client preserves the
error name end-to-end.

## Transition rules

- The `ExperienceQueue` is the only writer. Consumers receive the value through the read-only
  `Observable` exposed at `states.experienceRequestState`.
- A request transitions `pending` before the network call and either `success` after the output
  signals (`changes`, `profile`, `selectedOptimizations`) have been written, or `failed` when the
  underlying call rejects.
- `success` is published in the same reactive batch as the output signals. Consumers will never
  observe `success` while `selectedOptimizations` is still stale.
- Terminal states (`success`, `failed`) persist until the next request begins. They are not reset to
  `idle` between requests. Subscribers always see "the outcome of the last request."
- The next request flips the value to `pending` directly; there is no intermediate `idle` flicker.

## What this signal covers

- Adblockers or DNS errors that prevent the request from completing.
- The configured request timeout aborting an in-flight request.
- HTTP 4xx or 5xx responses from the Experience API.
- Response bodies that fail schema validation.

In all of these cases the signal transitions to a `failed` state and consumers can render the
baseline immediately.

## What this signal does not cover

- The case where no Experience API request is ever attempted because the integrating application did
  not call `page()`, `identify()`, `screen()`, or `track()`. In that case no flush occurs, the
  signal stays `idle`, and `OptimizedEntry` would still wait for optimization data that never
  arrives. Closing this gap requires a separate end-to-end resolution timer that transitions the
  state to `failed` after a configurable interval when no request has been observed. That timer is
  intentionally not part of this signal — it composes on top of it.
- Per-request retry semantics. Retries are owned by the queue's flush policy. The signal reports the
  outcome of each completed network call.

## Consumer pattern

Consumers subscribe to `experienceRequestState` alongside `canOptimize` and `optimizationPossible`,
and treat any `failed` state as a third escape hatch from "still loading":

```ts
isContentReady = canOptimize || !optimizationPossible || experienceRequestFailed
```

In the React web SDK, `useOptimizedEntry` applies this rule, so `OptimizedEntry` renders the
baseline content without any consumer changes when the Experience API fails. Other consumers that
gate rendering or branching on optimization data should mirror the rule.

## Cross-platform contract

The TypeScript signal lives in `core-sdk` and is consumed directly by the universal, web, Node, and
React Native runtimes. The native iOS and Android SDKs do not link to TypeScript core, so they
implement the same contract independently. Every platform that exposes optimization-driven rendering
must surface a state with:

- The same four states (`idle`, `pending`, `success`, `failed`).
- The same set of failure reasons (`timeout`, `api-error`, `aborted`).
- The "stay terminal until the next request" rule.
- The "publish `success` in the same batch as the output signals" rule.

Implementations that diverge from this contract will produce inconsistent behavior across platforms
when the Experience API fails. The contract is the cross-platform agreement; the TypeScript signal
is one realization of it.
