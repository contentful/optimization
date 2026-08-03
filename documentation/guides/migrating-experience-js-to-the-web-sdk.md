# Migrating experience.js to the Optimization Web SDK

Use this guide when a plain browser app or custom JavaScript adapter uses
`@ninetailed/experience.js` and you want to move to `@contentful/optimization-web`.

## What changes

The legacy browser client owns plugin arrays, legacy storage keys, browser globals, and imperative
event methods. The Web SDK uses one `ContentfulOptimization` instance for the browser runtime. Your
app owns Contentful fetching, routing, rendering, consent records, identity policy, and any
third-party forwarding.

Follow the [Web SDK integration guide](./integrating-the-web-sdk-in-a-web-app.md) for the target
setup details.

## Before you migrate

Gather these inputs:

- The module that constructs `Ninetailed`, any injected instance, and every plugin passed to it.
- Calls to `page`, `track`, `identify`, `batch`, `reset`, `debug`, flag reads, and manual rendering
  helpers.
- Use of `window.ninetailed`, `__nt_anonymous_id__`, `__anon_id`, `__nt_profile__`,
  `__nt_experiences__`, `__nt_changes__`, `__nt_debug__`, `__nt-consent__`, or `ntaid`.
- The app's consent and analytics policy.
- The Contentful entries that were resolved through legacy mapped experiences.
- The target Optimization `clientId`, environment, locale, and browser-visible config convention.
  These values identify the Contentful project and locale the browser runtime may call; keep secrets
  out of them and follow your bundler's public-variable convention.

## Migration path

1. Migrate authored Contentful entries first when the app depends on legacy `nt_*` fields. Start
   with one authored all-visitors variant. See
   [Migrating an experience.js Contentful model to Optimization](./migrating-experience-js-contentful-model-to-optimization.md).
2. Install `@contentful/optimization-web` and create one Web SDK instance for the browser runtime.
3. Replace the first `page()` call and entry resolution using the Web SDK guide.
4. Replace `identify`, `track`, flags, reset, and consent with target SDK calls and app-owned policy.
5. Move analytics, privacy, and preview plugins through
   [Migrating experience.js plugins and preview](./migrating-experience-js-plugins-and-preview.md).
6. Remove `@ninetailed/experience.js` and legacy plugin packages after imports are gone.

## Replace legacy surfaces

### Inventory the legacy browser integration

Start with the file that creates `new Ninetailed(...)` or injects an existing instance into a
provider. List every plugin and every module that reads `window.ninetailed`. Legacy provider props
did not re-create the client after construction, so treat client setup as a single runtime boundary
rather than a reactive config surface.

Also inventory persistence. Legacy browser storage and the `ntaid` cookie do not map directly to
the target cookie name or consent model. Decide whether to reset visitor identity during migration
or perform an app-owned continuity handoff.

### Replace client construction and lifecycle

Create one `ContentfulOptimization` instance and reuse it. The Web SDK is ready immediately after
construction, but optimization state is empty until an accepted event such as `page()` or
`identify()` returns selections. An accepted event returns `{ accepted: true, data? }`; stateful
browser runtimes also expose accepted events on `states.eventStream`. Keep the order:

1. Construct the instance.
2. Apply the visitor's current consent defaults.
3. Emit the page or identity event your policy allows.
4. Resolve entries or read flags after state is available.

Do not preserve legacy plugin arrays. Replace each plugin concern with the target SDK surface or an
app-owned integration.

### Replace page, track, identify, and reset calls

Map imperative calls by ownership:

- `page()` and route tracking move to Web SDK event methods or `trackCurrentPage()`.
- `identify({ userId, traits })` requires a user ID and returns an accepted or blocked result.
- `track({ event, properties })` owns application events.
- `reset()` clears SDK profile state and the SDK-owned `ctfl-opt-aid` cookie, but it does not clear
  your consent record.

The target consent model has two axes: event consent controls whether SDK events may be sent, and
persistence consent controls whether the SDK may store the profile-id cookie. With the default
pre-consent allow-list, `page` and `identify` can be admitted before explicit consent; set
`allowedEventTypes: []` if your policy requires every event to wait.

### Replace entry and flag rendering

Stop feeding mapped experience configuration into browser rendering. Pass a fetched baseline entry
to `resolveOptimizedEntry()` or use the Web Components path from the Web guide. When no selection
exists, links are unresolved, or the payload uses all locales, the resolver returns the baseline.

Replace legacy flag hooks with target flag reads. Stateful flag reads auto-attempt flag-view
tracking when consent and profile state allow it; `trackFlagView()` is the explicit manual path.

### Validate browser migration

Use the Web guide's production checks, then add migration-specific checks:

- One accepted page event populates selections before entry resolution.
- Denied or undecided consent behaves according to your app policy.
- Accepted events appear on `states.eventStream`; consent-blocked diagnostics appear on
  `states.blockedEventStream`.
- No code reads `window.ninetailed` or legacy storage keys.

## Validate the migration

- Run a browser route with a test all-visitors variant and verify variant rendering.
- Repeat with consent denied and verify blocked diagnostics or baseline behavior.
- Verify analytics forwarding, if any, dedupes by `messageId`.
- Search for remaining `@ninetailed/experience.js`, `window.ninetailed`, and legacy storage keys.

## Troubleshooting

| Symptom                                   | Check                                                                                                                                                      |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry resolution always returns baseline  | Confirm an accepted page or identify event returned selections before resolution, and confirm the Contentful payload contains linked Optimization entries. |
| A second SDK instance throws              | Keep one Web SDK instance per browser runtime; destroy only during teardown.                                                                               |
| Vendor analytics stopped receiving events | Replace legacy plugins with event-stream forwarding from the target SDK.                                                                                   |
| Flags read but views are missing          | Confirm consent, profile availability, and whether you need explicit `trackFlagView()`.                                                                    |

## Related guides

- [Web SDK integration guide](./integrating-the-web-sdk-in-a-web-app.md)
- [Migrating an experience.js Contentful model to Optimization](./migrating-experience-js-contentful-model-to-optimization.md)
- [Migrating experience.js plugins and preview](./migrating-experience-js-plugins-and-preview.md)
- [Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md)
