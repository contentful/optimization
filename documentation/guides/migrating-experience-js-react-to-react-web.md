# Migrating experience.js React to the React Web SDK

Use this guide when a React app uses `@ninetailed/experience.js-react` providers, hooks,
components, or flags and you want to move to `@contentful/optimization-react-web`.

## What changes

Legacy React surfaces wrap the browser `Ninetailed` client and render through `Personalize`,
`Experience`, `usePersonalize`, `useExperience`, and flag hooks. React Web uses
`OptimizationRoot`, target hooks, and `OptimizedEntry` over the Optimization content model. The app
keeps Contentful fetching, consent policy, identity policy, routing, analytics, and rendering
components.

Follow the [React Web integration guide](./integrating-the-react-web-sdk-in-a-react-app.md) for the
target provider and rendering setup.

## Before you migrate

Gather these inputs:

- The root where `NinetailedProvider` is mounted and any existing injected client.
- Every `Personalize`, `Experience`, `usePersonalize`, `useExperience`, `useProfile`, `useFlag`,
  `useFlagWithManualTracking`, and `TrackHasSeenComponent` call.
- Router page-tracking code, including whether the app uses React Router, TanStack Router, a custom
  router, or no router abstraction.
- Consent, identity, and analytics policy.
- Contentful entries that still depend on legacy mapper output or `nt_*` fields.

## Migration path

1. Migrate Contentful authoring when legacy `nt_*` fields feed React rendering. See
   [Migrating an experience.js Contentful model to Optimization](./migrating-experience-js-contentful-model-to-optimization.md).
2. Install `@contentful/optimization-react-web`.
3. Replace root wiring with `OptimizationRoot` and the appropriate router page tracker: React
   Router, TanStack Router, or an app-owned `trackPageView` call for a custom router.
4. Replace personalized rendering with `OptimizedEntry` or target entry hooks.
5. Replace flags, interactions, consent, identity, analytics, and preview through target surfaces.
6. Remove `@ninetailed/experience.js-react` and legacy browser packages after imports are gone.

## Replace legacy surfaces

### Inventory provider, hooks, and render components

Separate root setup from component-level rendering. Root setup includes `NinetailedProvider`,
plugins, page tracking, consent defaults, and any injected client. Component-level rendering
includes every `Personalize`, `Experience`, hook, flag read, and tracking wrapper.

This split keeps the first migration step small: get the target root and page event working before
rewriting every personalized component.

### Replace the provider and readiness model

Mount one `OptimizationRoot` around the tree that uses personalization. React Web creates the
underlying Web SDK after React commits, so readiness and loading state matter. Provider children
still render; optimized entries handle baseline and loading behavior at the entry boundary.

Do not rely on `window.ninetailed` or legacy provider prop changes. The target root owns the Web SDK
instance for the browser runtime, and app policy owns consent defaults.

### Replace personalized entry rendering

Replace legacy component and hook rendering with target entry resolution:

- Use `OptimizedEntry` when a component renders a Contentful entry.
- Use `useOptimizedEntry` or `resolveOptimizedEntry()` when you need custom control.
- Keep your existing presentational components; render the resolved entry through them.

Use one entry source per component:

- Use `baselineEntry` when your app already fetched the Contentful entry and owns the query,
  caching, and include depth.
- Use `entryId` only when `OptimizationRoot` has a `contentful` client for managed fetching.

Both paths return the baseline when no selection matches or linked entries are missing. If legacy
mapper code still builds experience arrays, migrate the Contentful model first.

### Replace flags and tracking side effects

Do not preserve legacy flag hook names as wrappers unless your app needs a temporary compatibility
layer. Use the target SDK flag APIs:

- `sdk.getFlag()` for a one-off read.
- `sdk.states.flag(name)` for a reactive read.
- `sdk.trackFlagView()` when you need explicit manual flag-view tracking.

React Web optimized entries track views, clicks, and hovers by default when consent and profile
state allow them. Accepted interaction events appear on the live SDK's `states.eventStream`; consent
blocks appear on `states.blockedEventStream`. If a legacy wrapper existed only to track component
views, replace it with `OptimizedEntry` tracking rather than a custom component.

### Replace consent, identity, analytics, and preview

Move policy and vendor work out of the core render migration:

- Consent uses app-owned state passed to the SDK through target consent actions or defaults.
- Identity uses target `identifyUser` and `resetUser` actions.
- Analytics vendors subscribe to accepted and blocked event streams instead of legacy plugins.
- Preview uses the Optimization preview panel package attached to the live Web SDK.

Use [Migrating experience.js plugins and preview](./migrating-experience-js-plugins-and-preview.md)
for those replacements.

### Validate React migration

Verify these outcomes before deleting the legacy packages:

- The React root mounts one Optimization SDK runtime.
- One page event is accepted or intentionally blocked by policy.
- A target `OptimizedEntry` renders the authored variant or baseline fallback.
- Interaction and flag-view events follow the target consent policy.
- No legacy React component or hook imports remain.

## Validate the migration

- Search for `@ninetailed/experience.js-react`, `Personalize`, `Experience`, `usePersonalize`,
  `useExperience`, `useFlag`, and `TrackHasSeenComponent`.
- Verify the app renders the same baseline entry with no matching variant.
- Verify an all-visitors variant renders after the page event.
- Verify accepted events and blocked diagnostics through the target SDK streams.

## Troubleshooting

| Symptom                           | Check                                                                                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| The first render has no SDK state | React Web initializes after commit; use entry loading and baseline behavior instead of reading live state during root setup.             |
| `OptimizedEntry` renders baseline | Confirm the Contentful payload includes linked Optimization entries and that a page or identify event populated selections.              |
| Interaction events are missing    | Check consent, profile availability, root/per-entry tracking opt-outs, and whether the rendered node carries target tracking attributes. |
| Preview does not attach           | Attach the preview panel to the live Web SDK, not the initial snapshot runtime.                                                          |

## Related guides

- [React Web integration guide](./integrating-the-react-web-sdk-in-a-react-app.md)
- [Web SDK integration guide](./integrating-the-web-sdk-in-a-web-app.md)
- [Migrating an experience.js Contentful model to Optimization](./migrating-experience-js-contentful-model-to-optimization.md)
- [Migrating experience.js plugins and preview](./migrating-experience-js-plugins-and-preview.md)
- [React Web reference implementation](../../implementations/react-web-sdk/README.md)
