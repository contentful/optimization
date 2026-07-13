# Integrating the Optimization React Native SDK in a React Native app

Use this guide to add Contentful personalization to a React Native or Expo app using
`@contentful/optimization-react-native`. By the end of the quick start, one Contentful entry will
render the personalized variant for the current visitor — or the original entry when none applies —
and one screen event will report the visitor's screen view to Contentful, which uses it to keep that
visitor's personalization consistent.

**New to personalization?** Here is the whole idea in five points:

- In Contentful you author **variants** of an entry and attach them to an **experience** — a rule
  that decides which visitors see which variant.
- As the app runs, Contentful's **Experience API** looks at who the visitor is and picks the variant
  for each experience. Swapping a fetched entry for its picked variant is called **resolving** the
  entry.
- The Experience API also returns a **profile**: the anonymous, per-visitor identity and state the
  anonymous, per-visitor identity and state used to keep personalization consistent across requests
  or app launches.
- Your app hands a Contentful entry to the SDK at the point where that entry becomes output. The SDK
  gives back the selected variant, or the original entry when no variant applies—the **baseline
  fallback**. You can fetch the entry yourself or give the SDK your Contentful client and an entry
  ID; either way, the client stays yours.
- You render the returned entry with the same application components you already use.

The React Native SDK persists the profile across app launches when persistence consent allows it.

That is enough to start. The guide introduces policy and optional capabilities at the point you need
them.

You will get there in two milestones:

- **Milestone 1 — one entry resolving and one screen event (the quick start below).** A single screen
  mounts `OptimizedEntry`, which renders the resolved variant or the baseline, and reports one screen
  event. This is complete and shippable on its own.
- **Milestone 2 — the opt-in layers (later).** Consent handoff, interaction tracking, identity, live
  updates, the preview panel, offline delivery, and analytics forwarding, each introduced by the
  section that needs it.

This guide uses `@contentful/optimization-react-native`. You mount one `OptimizationRoot` around your
app; it creates the SDK instance, restores state from AsyncStorage, and provides it to the hooks and
components below it. Your app still owns its Contentful Delivery API client, locale policy, consent
policy, identity policy, navigation, and final rendering.

## Quick start

Most React Native + Contentful apps share one shape: a screen fetches or receives a Contentful
entry, and somewhere in that screen the entry becomes a rendered component. This quick start assumes
that shape and proves the smallest result: **one screen renders a resolved entry — variant or
baseline — and reports one screen event.** It mounts one `OptimizationRoot`, hands the SDK your
Contentful client so it can fetch the entry by ID, and tracks the screen with `useScreenTracking`.

This quick start assumes your application policy permits Optimization to start with accepted consent
and renders no end-user consent UI, so it seeds `defaults={{ consent: true }}` — the shorthand that
accepts both consent axes at once. If personalization must wait for a consent decision, keep this
structure and add the [Consent and privacy-policy handoff](#consent-and-privacy-policy-handoff) step
before you ship, which explains the two axes and the object form that sets them separately.

1. Install the React Native SDK, its required AsyncStorage peer dependency, and a Contentful
   delivery client if your app does not already have one.

   **Copy this:**

   ```sh
   pnpm add @contentful/optimization-react-native @react-native-async-storage/async-storage contentful
   ```

   AsyncStorage ships native code, so complete your platform's native install step before launching:
   run `pod install` in `ios/` for a bare React Native app, or `npx expo prebuild` (a custom dev
   build) for Expo, then rebuild the app.

2. Mount `OptimizationRoot` with your app-owned Contentful client, emit one screen event for profile
   context, and render one single-locale Contentful entry by ID through `OptimizedEntry`.

   **Adapt this to your use case:**

   ```tsx
   import { Text } from 'react-native'
   import {
     OptimizationRoot,
     OptimizedEntry,
     useScreenTracking,
   } from '@contentful/optimization-react-native'
   import { createClient } from 'contentful'

   const APP_LOCALE = 'en-US'

   const contentfulClient = createClient({
     accessToken: 'your-contentful-delivery-token',
     environment: 'main',
     space: 'your-space-id',
   })

   function HomeScreen() {
     // Automatic screen tracking uses current-screen dedupe.
     useScreenTracking({ name: 'Home' })

     // OptimizedEntry passes the selected variant or baseline fallback to the renderer.
     return (
       <OptimizedEntry entryId="hero-entry-id">
         {(resolvedEntry) => <Text>{`Resolved entry: ${resolvedEntry.sys.id}`}</Text>}
       </OptimizedEntry>
     )
   }

   export function App() {
     // Use default accepted consent only when your application policy permits it.
     return (
       <OptimizationRoot
         clientId="your-optimization-client-id"
         environment="main"
         locale={APP_LOCALE}
         contentful={{
           client: contentfulClient,
           defaultQuery: {
             // An optimized entry links its experiences and their variants as nested entries; fetch
             // deep enough to pull them back in one payload (see Contentful entry fetching below).
             include: 10,
             locale: APP_LOCALE, // Keep CDA entries and SDK context on the same locale.
           },
         }}
         defaults={{ consent: true }}
         logLevel="debug" // Surface SDK activity, including the accepted screen event, so you can verify it.
       >
         <HomeScreen />
       </OptimizationRoot>
     )
   }
   ```

   The `App` and `HomeScreen` scaffolding above is illustrative context to match against your own
   app, not a file to paste over yours. Wrap your existing app root in `OptimizationRoot`, add
   `useScreenTracking` to a screen you already render, and wrap one entry you already render in
   `OptimizedEntry` — keep the rest of your components as they are.

3. Verify the first run. Launch the app; the screen displays a resolved entry ID for either the
   selected variant or the baseline. Because `logLevel="debug"` is set above, the SDK logs its
   activity to the console, so you can confirm the screen event fired by watching your Metro or
   device logs on mount for the `screen` event the SDK sends (the [Screen and navigation tracking](#screen-and-navigation-tracking)
   and [Analytics forwarding](#analytics-forwarding) sections add `states.eventStream` for a
   programmatic check). To see personalization rather than the baseline, author (in Contentful) a
   variant of `hero-entry-id` attached to an experience that targets all visitors — every visitor
   matches it automatically, so the resolved ID changes to the variant. Without an authored variant
   every launch shows the baseline entry, which is expected, not a failure.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Before you start](#before-you-start)
- [Core integration](#core-integration)
  - [Install and initialize `OptimizationRoot`](#install-and-initialize-optimizationroot)
  - [Consent and privacy-policy handoff](#consent-and-privacy-policy-handoff)
  - [Contentful entry fetching and locale shape](#contentful-entry-fetching-and-locale-shape)
  - [Entry resolution and fallback rendering](#entry-resolution-and-fallback-rendering)
  - [Screen and navigation tracking](#screen-and-navigation-tracking)
  - [Entry interaction tracking](#entry-interaction-tracking)
  - [Identity, profile continuity, and reset](#identity-profile-continuity-and-reset)
- [Optional integrations](#optional-integrations)
  - [Merge tags and Custom Flags](#merge-tags-and-custom-flags)
  - [Live updates](#live-updates)
  - [Preview panel](#preview-panel)
  - [Offline event delivery](#offline-event-delivery)
  - [Analytics forwarding](#analytics-forwarding)
- [Advanced integrations](#advanced-integrations)
  - [Explicit SDK instance ownership](#explicit-sdk-instance-ownership)
  - [Strict event admission and queue controls](#strict-event-admission-and-queue-controls)
  - [Platform build boundaries](#platform-build-boundaries)
- [Production checks](#production-checks)
- [Troubleshooting](#troubleshooting)
- [Reference implementations to compare against](#reference-implementations-to-compare-against)

<!-- mtoc-end -->
</details>

## Before you start

The sections below walk the integration in order. First, gather the few things you can only get from
outside this guide:

- **A React Native or Expo app** with React and React Native installed, its own Contentful fetching
  already working, and the ability to run a native build step (`pod install` for bare React Native,
  `npx expo prebuild` for Expo) — the SDK's required AsyncStorage peer dependency ships native code.
- **Contentful delivery credentials** — space ID, delivery token, and environment — read from your
  app's runtime configuration.
- **At least one entry with a variant attached to an experience**, authored in Contentful. Without
  an authored variant, the integration can still run correctly while returning the baseline, so you
  cannot yet distinguish working personalization from a content-authoring gap. For the first
  personalized-content test, target all visitors so the test request or visitor matches automatically.
- **Your Optimization project values** — client ID and environment, from your Optimization project
  settings. The Experience API (which picks variants) and the Insights API (which receives event and
  interaction delivery) each have a base URL that defaults correctly; you only set them for mocks or
  non-default hosts (see [Install and initialize `OptimizationRoot`](#install-and-initialize-optimizationroot)).

You do not need a setup inventory up front. Everything else — consent, entry resolution, screen
tracking, interaction tracking, identity, live updates, preview, offline delivery — is introduced by
the section that needs it.

> [!NOTE]
>
> Read the SDK and Contentful config from your app's runtime configuration. This guide's examples
> use inline placeholder strings for clarity; the reference implementation reads `PUBLIC_...`
> environment variables through `@env` because it runs against shared mock defaults. Use whatever
> environment variable convention your React Native tooling already uses and keep it consistent.

## Core integration

### Install and initialize `OptimizationRoot`

**Integration category:** Required for first integration

You mounted `OptimizationRoot` in the quick start; this section covers its full configuration
surface — `onStatesReady`, `api` host overrides, `logLevel`, and reading the SDK instance with
`useOptimization()`. `OptimizationRoot` is the normal React Native entry point: it creates the SDK
instance, waits for AsyncStorage-backed state setup, runs `onStatesReady` when provided, then renders
provider children. It also composes live-update and interaction-tracking context for descendant
components.

1. Mount one `OptimizationRoot` around all components that call React Native SDK hooks.
2. Pass `clientId` from runtime configuration. Pass `environment` only when you do not use the
   default Contentful environment; when you omit it the SDK uses `main`.
3. Pass `locale` when Experience API responses and event context must use the same app locale as
   your Contentful entry fetches.
4. Pass `api` endpoint overrides only for staging, mocks, or non-default production hosts. Both base
   URLs default correctly otherwise, so most apps omit `api` entirely.
5. Provide `onStatesReady` when app-level code must subscribe to SDK state before child effects run
   (see [Analytics forwarding](#analytics-forwarding)).

**Adapt this to your use case:**

```tsx
import { OptimizationRoot } from '@contentful/optimization-react-native'
import type { ReactNode } from 'react'

export function AppRoot({ children }: { children: ReactNode }) {
  // Override API hosts only for staging, mocks, or non-default production hosts.
  return (
    <OptimizationRoot
      clientId="your-optimization-client-id"
      environment="main"
      locale="en-US"
      api={{
        // Set these only for staging, mocks, or non-default hosts; both default correctly otherwise.
        experienceBaseUrl: 'https://experience.staging.example.com/',
        insightsBaseUrl: 'https://insights.staging.example.com/',
      }}
      logLevel="warn"
    >
      {children}
    </OptimizationRoot>
  )
}
```

Use `useOptimization()` under the provider when a component needs the SDK instance. The hook throws
outside `OptimizationRoot` or `OptimizationProvider`, and the provider-owned path withholds children
until the SDK is ready.

### Consent and privacy-policy handoff

**Integration category:** Common but policy-dependent

Consent policy belongs to your application. Consent has two independent axes: `events` (may the SDK
personalize and send events) and `persistence` (may the SDK store profile continuity in
AsyncStorage). The shorthand `consent: true` sets both to `true`; the object form
`{ events, persistence }` sets them separately. The SDK stores event consent, stores separate durable
profile-continuity persistence consent, and blocks non-allowed event types until event consent is
accepted.

1. If application policy permits Optimization by default and you do not render a user consent UI,
   seed accepted consent during SDK initialization.
2. If consent depends on user choice, leave `defaults.consent` unset and call
   `optimization.consent(true | false)` from the application-owned banner, CMP callback, or settings
   flow.
3. Use object-form consent when events are permitted but profile continuity must stay session-only.
4. Configure `allowedEventTypes` only after privacy review approves which events can emit before
   consent.
5. Subscribe to `states.blockedEventStream` during development when you need to verify blocked
   calls.

**Adapt this to your use case:**

```tsx
// Use this only when policy allows Optimization to start accepted.
<OptimizationRoot clientId="your-optimization-client-id" defaults={{ consent: true }}>
  <YourApp />
</OptimizationRoot>
```

**Adapt this to your use case:**

```tsx
import { Button, View } from 'react-native'
import { useOptimization } from '@contentful/optimization-react-native'

function ConsentControls() {
  const optimization = useOptimization()

  return (
    <View>
      {/* Boolean consent updates event consent and durable profile-continuity consent together. */}
      <Button title="Accept" onPress={() => optimization.consent(true)} />
      <Button title="Reject" onPress={() => optimization.consent(false)} />
    </View>
  )
}
```

By default, React Native permits `identify` and `screen` before event consent is accepted. Entry
views, entry taps, and any other event type are blocked until consent is accepted or that type is
allow-listed. Boolean consent calls control both event emission and durable profile continuity. Use
`optimization.consent({ events: true, persistence: false })` when events can emit but the stored
profile-continuity state must stay session-only. That state is the anonymous identity, the profile,
the **selected optimizations** (which variant the Experience API picked for each experience), and the
**changes** (the profile-backed values the Experience API returns for feature flags — named on/off or
valued settings — and merge tags — profile-driven substitutions in Rich Text; both are covered in
[Merge tags and Custom Flags](#merge-tags-and-custom-flags)) — all of which otherwise persist in
AsyncStorage across launches.

For cross-SDK policy details, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).

### Contentful entry fetching and locale shape

**Integration category:** Required for first integration

Your app owns the Contentful client and locale policy. The React Native SDK can call that client
when `contentful: { client }` is configured, or your app can fetch a manual `baselineEntry`. Both
paths must produce a standard single-locale Contentful CDA entry payload where optimized fields are
direct values, not locale-keyed maps.

1. Choose the application Contentful locale in your app configuration, i18n layer, or navigation
   layer.
2. Configure `contentful.defaultQuery` on the SDK, pass per-entry `entryQuery`, or pass the locale
   to manual Contentful CDA requests.
3. Request enough link depth for the SDK to resolve variants. `nt_experiences` (plural) is a fixed
   Optimization link field the SDK adds to an optimized entry; it links that entry's experiences,
   and each experience links its variant entries. Do not confuse it with `nt_experience` (singular),
   the content type of the experience entries it links to. Both are SDK-owned content-model names you
   do not choose. Your fetch must `include` deeply enough to pull those linked entries back in one
   payload. `include: 10` is the repository reference implementation's pattern.
4. Pass the same locale to SDK `locale` when Experience API responses and event context must use the
   same language.
5. Do not pass `contentful.js` `withAllLocales` results or raw CDA `locale=*` responses to
   `OptimizedEntry`, `useOptimizedEntry`, or `useEntryResolver`.
6. Pass `prefetchManagedEntries` to `OptimizationRoot` or `OptimizationProvider` when a screen knows
   the managed entries it will render soon and you want the SDK to warm its managed-entry cache
   after readiness.

**Adapt this to your use case:**

```tsx
const APP_LOCALE = 'en-US'

<OptimizationRoot
  clientId="your-optimization-client-id"
  locale={APP_LOCALE}
  contentful={{
    client: contentfulClient,
    defaultQuery: {
      include: 10, // Resolve optimization and variant links before SDK resolution.
      locale: APP_LOCALE, // Keep CDA entries and SDK context on the same locale.
    },
  }}
>
  <OptimizedEntry entryId="hero-entry-id">
    {(resolvedEntry) => <HeroCard entry={resolvedEntry} />}
  </OptimizedEntry>
</OptimizationRoot>
```

Manual fetching remains supported when your app needs request ownership around one entry:

**Adapt this to your use case:**

```tsx
const entry = await contentfulClient.getEntry('hero-entry-id', {
  include: 10,
  locale: APP_LOCALE,
})
```

Changing the provider `locale` prop after initialization calls `sdk.setLocale(nextLocale)`. After
the locale update, Experience API requests and event context use the new locale, but the SDK does
not refetch Contentful entries or refresh profile state. Refetch entries and run your normal
`screen()`, `identify()`, or profile refresh path when localized data must update.

`prefetchManagedEntries` accepts entry ID strings or `{ entryId, entryQuery }` descriptors. The
provider keeps rendering children while the cache warms. React Native does not expose
`prefetchedManagedEntries` because it has no server-to-client hydration handoff path.

For the entry contract, see
[Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).
For the broader locale model, see
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).

### Entry resolution and fallback rendering

**Integration category:** Required for first integration

`OptimizedEntry` resolves the selected Contentful variant for the current profile and passes
non-optimized entries through unchanged. Invalid, incomplete, or unmatched optimization data falls
back to the baseline entry instead of throwing.

The entry source is a discriminated union: pass either `entryId` (managed fetch) or `baselineEntry`
(manual fetch), never both.

1. Pass `entryId` to let the SDK fetch the baseline entry through the configured Contentful client
   (managed fetching, from the [Contentful entry fetching and locale shape](#contentful-entry-fetching-and-locale-shape)
   section).
2. Pass `baselineEntry` when your application already fetched the entry and must keep manual request
   ownership.
3. Use `loadingFallback`, `errorFallback`, and `onEntryError` when the managed fetch needs visible
   loading or error handling.
4. Use a render prop — a function passed as the child, which receives the resolved entry and returns
   your UI — when the child needs the resolved baseline or variant entry. This is the
   `{(resolvedEntry) => ...}` form the quick start used.
5. Use static children only when you need entry tracking but not variant data in the child.
6. Use `useOptimizedEntry()` for the same managed or manual source model without the wrapper
   component.
7. Use `useEntryResolver()` when a component needs manual-only resolution helpers.

**Adapt this to your use case:**

```tsx
import {
  OptimizedEntry,
  useEntryResolver,
  useOptimizedEntry,
} from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'

function HeroSection() {
  return (
    <OptimizedEntry
      entryId="hero-entry-id"
      loadingFallback={null}
      errorFallback={null}
      onEntryError={(error) => diagnostics.report(error)}
    >
      {(resolvedEntry) => <HeroCard entry={resolvedEntry} />}
    </OptimizedEntry>
  )
}

function HeroData() {
  // isPresentationReady is true once the entry is fetched and resolved and is safe to render.
  const { entry, isPresentationReady } = useOptimizedEntry({ entryId: 'hero-entry-id' })

  if (!isPresentationReady || !entry) return null

  return <HeroCard entry={entry} />
}

function HeroManualData({ baselineEntry }: { baselineEntry: Entry }) {
  const { resolveEntry } = useEntryResolver()
  // resolveEntry uses current selected optimizations and falls back to baseline content.
  const resolvedEntry = resolveEntry(baselineEntry)

  return <HeroCard entry={resolvedEntry} />
}
```

When you use the `useOptimizedEntry` hook directly, `isPresentationReady` is `true` once the entry
has been fetched (for a managed `entryId`) and resolved, so the returned `entry` is safe to render;
gate your render on it as the example does. `OptimizedEntry` handles this for you and only calls the
render prop when the entry is ready.

The resolved entry has the same field shape as the baseline entry, handed to the render prop as a
base `contentful` `Entry`. Cast it to your content-type interface in the child
(`resolvedEntry as HeroFields`) when your renderer needs the narrower type; the plain direct cast
works for common narrowed types. Downstream renderers can render the fields without branching on
whether the SDK returned a variant.

There are two distinct outcomes, and they use different props. The **baseline fallback** is a
resolution outcome on an entry the SDK already has: on denied consent, no matching variant,
unresolved links, or an all-locale payload, the render prop receives the baseline (original) entry
and the UI does not break. A **managed-fetch failure** is different: when `entryId` is used and the
SDK's fetch rejects, there is no entry to resolve, so `onEntryError` fires once and `OptimizedEntry`
renders `errorFallback` instead of the render prop. While a managed `entryId` fetch is unresolved,
`OptimizedEntry` shows `loadingFallback` until the fetch settles; there is no time limit on that
loading window, so provide a `loadingFallback` for any entry the reader waits on.

### Screen and navigation tracking

**Integration category:** Required for first integration

Screen events update the mobile profile and route-aware event context. The SDK gives you a React
Navigation adapter and two hook paths.

1. Use `OptimizationNavigationContainer` when your app uses React Navigation and you want automatic
   events for active route changes.
2. Use `useScreenTracking()` inside a screen when the app does not use React Navigation or when the
   event must wait for screen data.
3. Use `useScreenTrackingCallback()` for imperative tracking when the screen name comes from a deep
   link, navigation state transform, or another runtime value.
4. Avoid tracking the same route with both the navigation adapter and a screen hook.
5. Set `includeParams` on `OptimizationNavigationContainer` only when route params are approved for
   event payloads. Params are JSON-validated before they are attached.

**Adapt this to your use case:**

```tsx
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useEffect } from 'react'
import {
  OptimizationNavigationContainer,
  useScreenTracking,
} from '@contentful/optimization-react-native'

const Stack = createNativeStackNavigator()

function DetailsScreen({ dataLoaded }: { dataLoaded: boolean }) {
  // Disable mount tracking when the screen event must wait for app data.
  const { trackScreen } = useScreenTracking({
    name: 'Details',
    trackOnMount: false,
  })

  useEffect(() => {
    if (dataLoaded) {
      void trackScreen()
    }
  }, [dataLoaded, trackScreen])

  return <DetailsContent />
}

function NavigationShell() {
  return (
    // Use the navigation adapter as the single automatic route-tracking path.
    <OptimizationNavigationContainer>
      {(navigationProps) => (
        <NavigationContainer {...navigationProps}>
          <Stack.Navigator>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Details" component={DetailsScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      )}
    </OptimizationNavigationContainer>
  )
}
```

The automatic navigation path uses `trackCurrentScreen()` for current-screen deduplication. Direct
manual `screen()` calls are still direct event emits.

To verify screen tracking, open one tracked screen and confirm one accepted `screen` event through
SDK logs, `states.eventStream`, or your approved event inspection path.

### Entry interaction tracking

**Integration category:** Common but policy-dependent

Entry interaction tracking records views and taps for Contentful entries. View and tap tracking are
enabled by default on `OptimizedEntry`.

1. Decide whether entry view and tap events are allowed by your application's Analytics and privacy
   policy.
2. Set root defaults with `trackEntryInteraction` only when most entries need to opt out of a
   default interaction.
3. Override an individual entry with `trackViews`, `trackTaps`, or `onTap`.
4. Wrap scrollable screens with `OptimizationScrollProvider` so view tracking uses the actual scroll
   position.
5. Tune `minVisibleRatio`, `dwellTimeMs`, and `viewDurationUpdateIntervalMs` only when product
   analytics requirements differ from the defaults.

**Adapt this to your use case:**

```tsx
<OptimizationRoot clientId="your-optimization-client-id" defaults={{ consent: true }}>
  {/* Scroll context lets view tracking use the actual scroll viewport. */}
  <OptimizationScrollProvider>
    <OptimizedEntry
      baselineEntry={entry}
      dwellTimeMs={1000}
      minVisibleRatio={0.5}
      onTap={(resolvedEntry) => {
        navigation.navigate('EntryDetail', { id: resolvedEntry.sys.id })
      }}
    >
      {(resolvedEntry) => <EntryCard entry={resolvedEntry} />}
    </OptimizedEntry>
  </OptimizationScrollProvider>
</OptimizationRoot>
```

The default view threshold is 80% visibility (`minVisibleRatio` `0.8`) for 2000 ms (`dwellTimeMs`).
After the first view event, periodic duration updates emit every 5000 ms
(`viewDurationUpdateIntervalMs`) while the entry remains visible. Without
`OptimizationScrollProvider`, the SDK assumes `scrollY` is `0` and uses the screen height as the
viewport, which is appropriate only for non-scrollable or already-visible layouts.

React Native tracks two interactions: entry views and entry taps (there is no hover). A touch counts
as a tap only when the finger moves less than 10 points between touch start and end, so a scroll
gesture that starts on an entry does not register as a tap. On the wire, a tap is delivered as a
`component_click` event.

For event timing, scroll context, tap distance, and backgrounding mechanics, see
[React Native SDK interaction tracking mechanics](../concepts/react-native-sdk-interaction-tracking-mechanics.md).

### Identity, profile continuity, and reset

**Integration category:** Common but policy-dependent

Identity policy belongs to your application. The SDK can send known-user traits, maintain
profile-continuity state, and reset its in-memory profile state, but it does not decide when a user
becomes known or how account data is governed.

1. Call `identify({ userId, traits })` after authentication or account state proves the user's
   identity.
2. Keep traits limited to values approved for Optimization profile use.
3. Call `reset()` on sign-out, account switch, or privacy reset flows that must clear SDK profile
   state.
4. Use object-form consent when profile continuity persistence must differ from event consent.
5. Implement any web, server, or account continuity handoff in application code. React Native uses
   AsyncStorage and does not provide a built-in browser-cookie handoff.

**Adapt this to your use case:**

```tsx
import { Button, View } from 'react-native'
import { useOptimization } from '@contentful/optimization-react-native'

function AccountControls() {
  const optimization = useOptimization()

  return (
    <View>
      <Button
        title="Identify"
        onPress={() => {
          // identify links the app-owned user ID to the current mobile profile.
          void optimization.identify({
            userId: 'user-123',
            traits: { plan: 'pro' },
          })
        }}
      />
      <Button title="Reset" onPress={() => optimization.reset()} />
    </View>
  )
}
```

AsyncStorage persists consent state and, when persistence consent permits it, profile, selected
optimizations, changes, and anonymous identity across app launches. It does not persist SDK event
queues. Live SDK state after startup comes from in-memory SDK state, not repeated AsyncStorage
reads.

For advanced anonymous ID ownership, pass `getAnonymousId` to `OptimizationRoot` or
`ContentfulOptimization.create(...)` only when your app owns an approved anonymous ID that
Optimization can use. Otherwise, omit it and rely on the React Native SDK's AsyncStorage-backed
anonymous ID default.

## Optional integrations

### Merge tags and Custom Flags

**Integration category:** Optional

Use merge tags and Custom Flags when your app renders profile-backed Rich Text values or feature
values returned in the Experience API `changes` data. Entry replacement and flag rendering are
separate decisions: `OptimizedEntry` chooses an entry variant, while flags and merge tags read
profile-backed values from SDK state.

1. Resolve merge tags inside your app-owned Rich Text renderer with the SDK instance returned by
   `useOptimization()`.
2. Subscribe to `sdk.states.flag(name)` when a component needs to rerender as a flag value changes.
3. Treat flag values and merge-tag values as profile-dependent runtime data, not as static
   Contentful content.

**Adapt this to your use case:**

```tsx
import { useEffect, useState } from 'react'
import { Text } from 'react-native'
import { useOptimization } from '@contentful/optimization-react-native'

function PromoFlag() {
  const optimization = useOptimization()
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    // Subscribe once per flag value that must rerender as profile state changes.
    const subscription = optimization.states.flag('show-promo').subscribe((value) => {
      setEnabled(value === true)
    })

    return () => subscription.unsubscribe()
  }, [optimization])

  return enabled ? <Text>Promo</Text> : null
}
```

For the deeper data model, see
[Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#merge-tags-and-localized-profile-values).

### Live updates

**Integration category:** Optional

By default, `OptimizedEntry` locks to the first selected variant it receives for that component
lifetime. This prevents visible content changes when profile state changes while the user is viewing
the entry.

1. Set `liveUpdates` on `OptimizationRoot` when all optimized entries in the app can react to
   profile and variant changes.
2. Set `liveUpdates` on an individual `OptimizedEntry` when only one section can update in place.
3. Use `useLiveUpdates()` only for UI that needs to display or react to the live-update state.
4. Remember that the preview panel forces live updates while it is open.

**Adapt this to your use case:**

```tsx
<OptimizationRoot clientId="your-optimization-client-id" liveUpdates>
  {/* Per-entry false keeps this section locked even when root live updates are enabled. */}
  <OptimizedEntry baselineEntry={dashboardEntry} liveUpdates={false}>
    {(resolvedEntry) => <Dashboard entry={resolvedEntry} />}
  </OptimizedEntry>
</OptimizationRoot>
```

Live-update resolution order is preview panel open, component `liveUpdates` prop, `OptimizationRoot`
`liveUpdates` prop, then the default locked behavior.

### Preview panel

**Integration category:** Optional

The preview panel is an in-app authoring and debugging surface. It fetches your audience and
experience definitions (`nt_audience` and `nt_experience`, the fixed Optimization content types, not
names you choose) through the Contentful client you provide, lets users override audiences and
variants locally, and forces live updates while the panel is open.

1. Install the preview peer dependencies before importing the preview subpath.
2. Mount `PreviewPanelOverlay` under `OptimizationRoot`.
3. Pass a Contentful client that can fetch the space and environment containing Optimization
   audience and experience entries.
4. Gate the panel behind `__DEV__` or an equivalent internal build flag.
5. Provide `onRefresh` when the panel must trigger a fresh Experience API request after overrides.

**Copy this:**

```sh
pnpm add @react-native-clipboard/clipboard react-native-safe-area-context
```

**Adapt this to your use case:**

```tsx
import { OptimizationRoot, useOptimization } from '@contentful/optimization-react-native'
import { PreviewPanelOverlay } from '@contentful/optimization-react-native/preview'
import { createClient } from 'contentful'

const contentfulClient = createClient({
  accessToken: 'your-contentful-delivery-token',
  environment: 'main',
  space: 'your-space-id',
})

function AppContent() {
  const optimization = useOptimization()

  return (
    <>
      <YourApp />
      {/* Gate preview UI out of production builds. */}
      {__DEV__ && (
        <PreviewPanelOverlay
          contentfulClient={contentfulClient}
          onRefresh={() => {
            // Re-emit a screen event to refresh selected optimizations after preview overrides.
            void optimization.screen({ name: 'Preview Refresh' })
          }}
        />
      )}
    </>
  )
}

export function App() {
  return (
    <OptimizationRoot clientId="your-optimization-client-id">
      <AppContent />
    </OptimizationRoot>
  )
}
```

`PreviewPanelOverlay` must be rendered inside `OptimizationRoot`, or inside both
`OptimizationProvider` and `LiveUpdatesProvider`. Expo apps that use preview native modules need a
custom dev build, such as `expo run:ios` or `expo run:android`; Expo Go is not enough.

### Offline event delivery

**Integration category:** Optional

When `@react-native-community/netinfo` is installed, the SDK listens for connectivity changes.
NetInfo gates flushing while the app is offline and resumes flushing when the device is reachable.
Offline replay is in memory while the JavaScript process remains alive; NetInfo does not create a
durable event outbox. When NetInfo is absent, the SDK logs a warning and runs without offline
detection.

1. Install NetInfo when the app must replay in-memory SDK events after offline periods.
2. Keep queue sizing and drop policy aligned with product Analytics requirements.
3. Verify that app backgrounding flushes queues and drains pending AsyncStorage writes on your
   supported platforms. AsyncStorage persistence covers consent and profile continuity, not event
   queues.

**Copy this:**

```sh
pnpm add @react-native-community/netinfo
```

The SDK also listens for React Native `AppState` transitions to `background` or `inactive` and calls
`flush()` before the operating system can suspend the process.

### Analytics forwarding

**Integration category:** Optional

Use Analytics forwarding when your mobile app already sends events to a customer-data platform,
product analytics destination, or vendor SDK. The Optimization SDK still sends its own events to
Contentful. Your application decides which approved Contentful context can also be forwarded.

1. Attach app-level subscriptions with `onStatesReady` so subscribers register before child effects
   can emit screen, entry, or blocked-event updates.
2. Read `states.eventStream` for SDK events that were accepted.
3. Read `states.blockedEventStream` to verify consent and `allowedEventTypes` blocks during
   development.
4. Dedupe forwarded events by `messageId` or by destination-specific semantic keys when one user
   action produces multiple event deliveries.
5. Store forwarded message IDs in module or app state so remounts do not forward the same event
   again. If the destination must receive only future SDK events, read the current `messageId`
   before subscribing and skip that event.
6. Apply the same consent, privacy, and data-minimization policy to forwarded payloads that you
   apply to first-party SDK events.

**Adapt this to your use case:**

```tsx
const forwardedMessageIds = new Set<string>()

<OptimizationRoot
  clientId="your-optimization-client-id"
  onStatesReady={(states) => {
    // Register before child effects emit screen, entry, or flag events.
    const initialMessageId = states.eventStream.current?.messageId

    const subscription = states.eventStream.subscribe((event) => {
      if (!event) return
      if (forwardedMessageIds.has(event.messageId)) return
      if (event.messageId === initialMessageId) {
        forwardedMessageIds.add(event.messageId)
        return
      }
      if (!canForwardSdkEvent(event)) return

      forwardedMessageIds.add(event.messageId)
      analytics.track(`Contentful ${event.type}`, pickContentfulEventProperties(event))
    })

    return () => subscription.unsubscribe()
  }}
>
  <YourApp />
</OptimizationRoot>
```

Use
[Forwarding Optimization SDK context to analytics and tag-management tools](./forwarding-optimization-sdk-context-to-analytics-and-tag-management-tools.md)
for destination mapping, consent, identity, dedupe, and governance guidance.

## Advanced integrations

### Explicit SDK instance ownership

**Integration category:** Advanced or production-only

Use explicit instance ownership only when a framework adapter, test harness, or application service
must create the SDK before React renders. `OptimizationRoot` is the preferred path for normal React
Native apps.

1. Create the SDK with `await ContentfulOptimization.create(config)`. `create` is `async` and
   returns a `Promise<ContentfulOptimization>` because it reads AsyncStorage before constructing.
2. Pass the resolved instance to `OptimizationProvider sdk={sdk}`.
3. Wrap the tree in the exported `LiveUpdatesProvider` only when preview tooling or global
   live-update state must work without `OptimizationRoot`.
4. Call `destroy()` from the owner during teardown, once the instance is done. `OptimizationProvider`
   does not destroy an injected SDK; `destroy()` clears the singleton so a new instance can be
   created.
5. Do not create a second active React Native SDK instance without destroying the first one:
   `create` throws `ContentfulOptimization React Native SDK is already initialized. Reuse the
existing instance.` while a live instance exists.
6. Use per-entry `trackViews` and `trackTaps` for interaction policy in injected-provider flows;
   `trackEntryInteraction` is an `OptimizationRoot` convenience.

**Follow this pattern:**

```tsx
import { ContentfulOptimization, OptimizationProvider } from '@contentful/optimization-react-native'

const sdk = await ContentfulOptimization.create({
  clientId: 'your-optimization-client-id',
  environment: 'main',
  locale: 'en-US',
})
// The owner that creates an injected SDK must call sdk.destroy() during teardown.

function App() {
  return (
    <OptimizationProvider sdk={sdk}>
      <YourApp />
    </OptimizationProvider>
  )
}
```

### Strict event admission and queue controls

**Integration category:** Advanced or production-only

Use strict controls when privacy review, regulated deployments, or constrained mobile networks need
behavior beyond the default React Native settings.

1. Set `allowedEventTypes={[]}` when no event can emit before explicit event consent.
2. Use `onEventBlocked` to surface consent or guard failures in diagnostics.
3. Configure `queuePolicy.offlineMaxEvents` and `queuePolicy.onOfflineDrop` when the offline
   Experience buffer must have explicit bounds and observability.
4. Configure `queuePolicy.flush` only when flush behavior must differ from SDK defaults across shared
   Insights and Experience delivery.
5. Use `api` endpoint overrides and `fetchOptions` for staging, mocks, and request-level options such
   as `requestTimeout` and `retries`.

**Adapt this to your use case:**

```tsx
// Empty allow-list means no event emits before explicit consent.
<OptimizationRoot
  clientId="your-optimization-client-id"
  allowedEventTypes={[]}
  onEventBlocked={(blocked) => {
    // blocked is { reason, method, args }: the blocked method name and its original arguments.
    diagnostics.log('Optimization event blocked', blocked.method)
  }}
  queuePolicy={{
    // Bound the offline Experience buffer for constrained mobile networks.
    offlineMaxEvents: 50,
    onOfflineDrop: ({ droppedCount }) => {
      // The callback receives a context object; droppedCount is how many events were dropped.
      diagnostics.log('Dropped offline Experience events', { droppedCount })
    },
  }}
  fetchOptions={{
    requestTimeout: 3000, // ms before a request times out (default 3000).
    retries: 1, // retry attempts on failure (default 1).
  }}
>
  <YourApp />
</OptimizationRoot>
```

### Platform build boundaries

**Integration category:** Advanced or production-only

React Native platform setup determines which optional SDK behavior is available at runtime.

1. Run native install steps for AsyncStorage and any optional native peer dependency you add.
2. Use a custom Expo dev build for preview panel dependencies; Expo Go cannot load the required
   native modules.
3. Keep preview UI out of production builds with build flags or internal distribution channels.
4. When testing against a local mock server on the Android emulator, rewrite `localhost` API hosts
   to the emulator host alias `10.0.2.2` in your own app configuration. The SDK has no localhost
   rewrite; this is app-config you own. The reference implementation does exactly this in
   `env.config.ts` (`localhost` → `10.0.2.2` on Android; the iOS Simulator uses the host network
   directly).
5. For release builds, verify that the Contentful CDA host, Experience API host, and Insights API
   host point to the intended environment.

## Production checks

Before release, verify these checks in the app build and environment that will ship:

- **Credentials and runtime configuration** - The app uses the intended Optimization `clientId`,
  Optimization environment, API hosts, Contentful space, Contentful environment, CDA token, and app
  locale. Android emulator-only localhost rewrites are not present in production configuration.
- **Consent behavior** - Default accepted consent is used only when policy permits it. User-choice
  flows call `consent(true | false)`, object-form consent matches the persistence policy, and
  rejected consent blocks non-allowed event types.
- **Event delivery** - Screen, identify, entry view, entry tap, Custom Flag, and forwarded Analytics
  events appear in the expected destinations. In-memory offline replay and background flushing are
  verified when NetInfo is installed.
- **Content fallback behavior** - Optimized entries are fetched with one CDA locale and enough link
  depth. Non-optimized, unmatched, or incomplete entries render baseline content instead of blank
  UI.
- **Duplicate tracking prevention** - One `OptimizationRoot` owns the app runtime, each route uses
  one screen-tracking path, and the app does not wrap the same rendered entry multiple times for one
  impression. Forwarded events are deduped before leaving the app.
- **Privacy and governance** - Forwarded Analytics payloads are allow-listed, profile traits are
  approved, preview UI is absent from production builds, and persisted profile continuity matches
  consent records.
- **Local validation path** - Compare behavior against the React Native reference implementation and
  run the smallest meaningful app validation for the changed flow, such as typecheck, lint, or a
  targeted Detox file through the repository runner.

## Troubleshooting

| Symptom                                 | Check                                                                                                                                                | Fix                                                                                                                                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider children do not render         | SDK initialization failed, or another active React Native SDK instance already exists                                                                | Check `logLevel` output, keep one active SDK instance, and call `destroy()` before replacement instances                                                                          |
| Entry views do not appear               | Consent is unset or rejected, `trackViews` is false, visibility timing has not elapsed, or scrollable view-tracking content has no scroll context    | Accept consent, inspect `trackViews` overrides, wait for the dwell threshold, and wrap scrollable view-tracking content in `OptimizationScrollProvider`                           |
| Entry taps do not appear                | Consent is unset or rejected, `trackTaps` is false, tap movement exceeds the tap threshold, or child touch handling prevents the tap from completing | Accept consent, inspect `trackTaps` and `onTap` overrides, keep touch movement within the tap threshold, and verify touch handling still lets `OptimizedEntry` receive tap events |
| Entries always render baseline content  | The entry was fetched with all locales, unresolved links, insufficient include depth, or no selected optimization state                              | Fetch one CDA locale with linked optimization data and emit `screen()` or `identify()` before expecting profile-selected variants                                                 |
| Screen events are missing or duplicated | The app mixes `OptimizationNavigationContainer`, `useScreenTracking`, and manual `screen()` for the same route                                       | Use one screen-tracking path per route and reserve manual `screen()` for custom lifecycle cases                                                                                   |
| Preview panel fails to open             | Preview peer dependencies are missing, the panel is outside `OptimizationRoot`, or the build uses Expo Go                                            | Install preview peers, mount the panel under `OptimizationRoot`, and use a custom native dev build                                                                                |
| Offline replay does not happen          | NetInfo is not installed, the in-memory queue is full, the JavaScript process restarted, or the app is testing against always-online mocks           | Install NetInfo, configure queue bounds, and test a real offline-to-online transition without restarting the app process                                                          |
| Render prop type error on the entry     | The render prop hands back a base `contentful` `Entry`, wider than your content-type interface                                                       | Cast the resolved entry to your interface in the child (`resolvedEntry as HeroFields`); the plain direct cast works for common narrowed types                                     |

## Reference implementations to compare against

- [React Native reference implementation](../../implementations/react-native-sdk/README.md) - The
  in-tree React Native app that demonstrates provider setup, consent bootstrap, CDA locale handling,
  optimized entry rendering, scroll provider usage, tap tracking, navigation tracking, live updates,
  preview panel behavior, offline behavior, and Detox E2E coverage.
