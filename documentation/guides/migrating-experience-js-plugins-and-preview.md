# Migrating experience.js plugins and preview

Use this guide when an app uses experience.js analytics, privacy, preview, insights, or third-party
plugin packages and you need to replace them with Optimization SDK Suite surfaces.

## What changes

Legacy plugin packages are not one-for-one target packages. Privacy moves to app-owned consent plus
SDK consent inputs. Vendor analytics moves to event-stream forwarding or app-owned business events.
Preview moves to the Optimization preview panel attached to the live Web SDK. Insights delivery is
part of the target SDK event and interaction model.

Use this after at least one target runtime guide is in place.

## Before you migrate

Gather these inputs:

- Every `@ninetailed/experience.js-plugin-*` package and plugin constructor.
- Code that reads `window.ninetailed.plugins`, `window.ninetailed.consent`, or preview globals.
- Current accepted and blocked consent behavior.
- Vendor destinations such as Google Tag Manager, Segment, Contentsquare, or product analytics.
- Preview workflows authors depend on.
- The target runtime guide for Web, React Web, App Router, or Pages Router.

## Migration path

1. Inventory plugin packages and globals.
2. Replace privacy plugin behavior with app-owned consent policy and target SDK consent inputs.
3. Replace analytics and tag-manager plugins with event-stream forwarding.
4. Replace preview plugin behavior with the Optimization preview panel.
5. Validate accepted events, blocked diagnostics, preview overrides, and package removal.

## Replace legacy surfaces

### Inventory plugin packages and globals

List each plugin by purpose, not by package name:

- Privacy and consent filtering.
- Third-party analytics or tag-manager forwarding.
- Preview widget and bridge behavior.
- Insights batching or custom event delivery.

Then search for globals. Target SDK code should not depend on `window.ninetailed`, plugin globals,
or `__nt-consent__`.

### Replace privacy plugin behavior

The legacy privacy plugin stored consent and filtered events, traits, properties, profile merging,
and features. In the target SDK, the app owns the consent record and passes the current decision to
the SDK. Event consent and persistence consent are separate axes.

Use the runtime guide's consent section to decide:

- Which events may be admitted before explicit consent.
- Whether profile persistence is allowed.
- Where the app stores the visitor's consent decision.
- How blocked events are observed through `onEventBlocked` or `states.blockedEventStream`.

Use the exact runtime section for the app:
[Web consent](./integrating-the-web-sdk-in-a-web-app.md#consent-and-privacy-handoff),
[React Web consent](./integrating-the-react-web-sdk-in-a-react-app.md#consent-and-privacy-handoff),
[App Router consent](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md#consent-identity-profile-and-reset),
or
[Pages Router consent](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md#consent-identity-profile-and-reset).

Do not expect blocked legacy payloads to replay after consent changes. Re-emit application events
that still need to happen under the accepted policy.

### Replace analytics and tag-manager plugins

Replace vendor plugins with the
[analytics forwarding guide](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md).
Subscribe to accepted event streams in stateful browser runtimes and use request-local event results
on server runtimes. Dedupe accepted events by `messageId`, and forward only approved primitive
fields. `states.eventStream` carries accepted events; `states.blockedEventStream` carries only
consent-blocked diagnostics. `onEventBlocked` receives the same blocked diagnostic as a callback,
which is useful when you want logging without a browser-state subscription.

Keep vendor consent separate from SDK consent. SDK consent controls SDK event emission; your app's
analytics policy controls whether data leaves your application boundary for a vendor.

### Replace preview plugin behavior

Use the Optimization preview panel for Web and React Web based runtimes. The panel attaches to the
live Web SDK, reads audience and experience definitions from a Contentful client or pre-fetched
entries, and applies preview overrides to selected optimizations and flag changes. Provide either a
`contentful.js` client through `contentful` so the panel can fetch preview entries, or pass
pre-fetched `entries: { audiences, experiences }`.

Preview overrides can force audiences, variants, and inline-variable flag values. Validate a forced
variant by opening the panel, selecting a non-baseline variant, and watching the optimized entry
change without a page reload. Validate an inline flag by forcing a flag value in the panel and
checking that `getFlag()` or `states.flag(name)` returns that value while the panel is open. While
the panel is open, optimized entries live-update so authors can inspect changes. Legacy preview
widget globals are not target extension points.

### Validate plugin migration

Run these checks after the core runtime migration works:

- Denied consent produces blocked diagnostics for events your policy blocks.
- Accepted SDK events appear once in the forwarding destination.
- Preview panel attaches to the live SDK and can force a variant or inline flag value.
- No legacy plugin package or `window.ninetailed` plugin global remains.

## Validate the migration

- Search for `@ninetailed/experience.js-plugin`, `window.ninetailed.plugins`,
  `window.ninetailed.consent`, and `__nt-consent__`.
- Verify accepted and blocked event streams in the target runtime.
- Verify the analytics forwarding guide's dedupe behavior with one SDK activity.
- Verify the preview panel only loads in the environments where your app enables it.

## Troubleshooting

| Symptom                                                   | Check                                                                                                                        |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Blocked events disappear                                  | Observe `states.blockedEventStream` or `onEventBlocked`; blocked events are diagnostics, not a replay queue.                 |
| Vendor events duplicate                                   | Dedupe forwarded accepted events by `messageId` outside component or subscriber lifecycles.                                  |
| Preview attaches but does not update entries              | Attach to the live Web SDK and confirm the panel has audience and experience entries.                                        |
| Consent appears accepted in the app but SDK blocks events | Confirm the app passes the current consent decision into the target SDK runtime and that `allowedEventTypes` matches policy. |

## Related guides

- [Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md)
- [Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md)
- [Web SDK integration guide](./integrating-the-web-sdk-in-a-web-app.md)
- [React Web integration guide](./integrating-the-react-web-sdk-in-a-react-app.md)
- [Next.js App Router integration guide](./integrating-the-optimization-sdk-in-a-nextjs-app-router-app.md)
- [Next.js Pages Router integration guide](./integrating-the-optimization-sdk-in-a-nextjs-pages-router-app.md)
