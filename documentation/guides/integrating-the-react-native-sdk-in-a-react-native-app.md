# Integrating the Optimization React Native SDK in a React Native app

Use this guide when you want to add mobile personalization, Analytics events, screen tracking, and
optional preview tooling to a React Native or Expo application with
`@contentful/optimization-react-native`.

The React Native SDK builds on the Optimization Core SDK and adds React Native providers, hooks,
entry rendering, viewport and tap tracking, AsyncStorage persistence, optional offline delivery, and
an in-app preview panel. Your application still owns Contentful Delivery API fetching, consent
policy, identity policy, navigation, and final rendering.

## Quick start

Use this path when your application policy permits Optimization to start with accepted consent. If
your policy requires an end-user choice first, complete the consent handoff section before sending
events or rendering personalized content.

1. Install the React Native SDK, its required AsyncStorage peer dependency, and a Contentful
   delivery client if your app does not already have one.

   **Copy this:**

   ```sh
   pnpm add @contentful/optimization-react-native @react-native-async-storage/async-storage contentful
   ```

2. Mount `OptimizationRoot`, emit one screen event for profile context, fetch one single-locale
   Contentful entry with linked optimization data, and render the resolved entry ID through
   `OptimizedEntry`.

   **Copy this:**

   ```tsx
   import { useEffect, useState } from 'react'
   import { Text } from 'react-native'
   import {
     OptimizationRoot,
     OptimizedEntry,
     useScreenTracking,
   } from '@contentful/optimization-react-native'
   import { createClient, type Entry } from 'contentful'

   const APP_LOCALE = 'en-US'

   const contentfulClient = createClient({
     accessToken: 'your-contentful-delivery-token',
     environment: 'main',
     space: 'your-space-id',
   })

   function HomeScreen() {
     const [entry, setEntry] = useState<Entry | undefined>()

     // Automatic screen tracking uses current-screen dedupe.
     useScreenTracking({ name: 'Home' })

     useEffect(() => {
       void contentfulClient
         .getEntry('hero-entry-id', {
           include: 10, // Resolve optimization and variant links before SDK resolution.
           locale: APP_LOCALE, // Keep CDA entries and SDK context on the same locale.
         })
         .then(setEntry)
     }, [])

     if (!entry) return null

     // OptimizedEntry passes the selected variant or baseline fallback to the renderer.
     return (
       <OptimizedEntry baselineEntry={entry}>
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
         defaults={{ consent: true }}
       >
         <HomeScreen />
       </OptimizationRoot>
     )
   }
   ```

3. Verify the first run. The app displays a resolved entry ID for either the selected variant or the
   baseline fallback.

<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

- [Required setup](#required-setup)
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

## Required setup

Use this setup inventory before you move beyond the quick start:

| Setup item                                                                | Category                       | Required for quick start | Where to configure                                                                     |
| ------------------------------------------------------------------------- | ------------------------------ | ------------------------ | -------------------------------------------------------------------------------------- |
| React Native app with compatible React and React Native peer dependencies | Required for first integration | Yes                      | Application package dependencies                                                       |
| `@contentful/optimization-react-native` package                           | Required for first integration | Yes                      | Application package dependencies                                                       |
| `@react-native-async-storage/async-storage` peer dependency               | Required for first integration | Yes                      | Application package dependencies and native install flow                               |
| Contentful Delivery API client                                            | Required for first integration | Yes                      | Application package dependencies and app-owned Contentful client factory               |
| Optimization client ID and environment                                    | Required for first integration | Yes                      | `OptimizationRoot`, `OptimizationProvider`, or `ContentfulOptimization.create(...)`    |
| Experience API and Insights API endpoint overrides                        | Common but policy-dependent    | No                       | `api` SDK config for staging, mock, or non-default hosts                               |
| Contentful space, environment, access token, and CDA host                 | Required for first integration | Yes                      | Application-owned Contentful fetching layer                                            |
| Optimized Contentful entries with resolved `nt_experiences` and variants  | Required for first integration | Yes                      | Contentful content model and CDA `include` depth                                       |
| Single Contentful CDA locale and SDK Experience/event locale              | Required for first integration | Yes                      | App locale policy, Contentful `getEntry()` calls, and SDK `locale`                     |
| `OptimizationRoot` mounted once around SDK consumers                      | Required for first integration | Yes                      | React Native app root or navigation root                                               |
| Screen, route, or lifecycle integration                                   | Required for first integration | Yes                      | `useScreenTracking`, `useScreenTrackingCallback`, or `OptimizationNavigationContainer` |
| Entry rendering through `OptimizedEntry` or `useEntryResolver`            | Required for first integration | Yes                      | React Native components that render Contentful entries                                 |
| Consent startup policy and user-choice wiring                             | Common but policy-dependent    | Conditional              | SDK `defaults`, `allowedEventTypes`, and application consent UI or CMP callbacks       |
| Entry view and tap tracking policy                                        | Common but policy-dependent    | Conditional              | `trackEntryInteraction` on `OptimizationRoot` and per-entry tracking props             |
| User identity, profile continuity, and reset policy                       | Common but policy-dependent    | No                       | Authentication, account, or settings flows that call `identify()` and `reset()`        |
| React Navigation integration                                              | Optional                       | No                       | App navigation dependencies and `OptimizationNavigationContainer`                      |
| `@react-native-community/netinfo` for offline detection                   | Optional                       | No                       | Application package dependencies and native install flow                               |
| Preview peer dependencies                                                 | Optional                       | No                       | `@react-native-clipboard/clipboard` and `react-native-safe-area-context`               |
| Merge tag and Custom Flag rendering                                       | Optional                       | No                       | App-owned Rich Text, flag, or feature-rendering components                             |
| Analytics forwarding destination                                          | Optional                       | No                       | `onStatesReady` subscriptions and application-owned analytics code                     |
| Strict pre-consent allowlist, queue policy, and diagnostics               | Advanced or production-only    | No                       | SDK `allowedEventTypes`, `queuePolicy`, `onEventBlocked`, and `logLevel`               |
| Preview release gating and custom native builds                           | Advanced or production-only    | No                       | Build flags, Expo custom dev builds, and release configuration                         |

The React Native SDK does not fetch Contentful entries. Fetch entries in your application layer,
then pass single-locale entry objects to SDK components and hooks.

## Core integration

### Install and initialize `OptimizationRoot`

**Integration category:** Required for first integration

`OptimizationRoot` is the normal React Native entry point. It creates the SDK instance, waits for
AsyncStorage-backed state setup, runs `onStatesReady` when provided, then renders provider children.
It also composes live-update and interaction-tracking context for descendant components.

1. Install `@contentful/optimization-react-native` and `@react-native-async-storage/async-storage`.
2. Mount one `OptimizationRoot` around all components that call React Native SDK hooks.
3. Pass `clientId` from runtime configuration. Pass `environment` when you do not use the default
   Contentful environment, `main`.
4. Pass `locale` when Experience API responses and event context must use the same app locale as
   your Contentful entry fetches.
5. Pass `api` endpoint overrides only for staging, mocks, or non-default production hosts.

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
        experienceBaseUrl: 'https://experience.ninetailed.co/',
        insightsBaseUrl: 'https://ingest.insights.ninetailed.co/',
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

Consent policy belongs to your application. The SDK stores event consent, stores separate durable
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

**Copy this:**

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
views, entry taps, `page`, and custom `track` events are blocked until consent is accepted or their
event types are allow-listed. Boolean consent calls control both event emission and durable profile
continuity. Use `optimization.consent({ events: true, persistence: false })` when events can emit
but profile, selected optimizations, changes, and anonymous identity must stay session-only.

For cross-SDK policy details, see
[Consent management in the Optimization SDK Suite](../concepts/consent-management-in-the-optimization-sdk-suite.md).

### Contentful entry fetching and locale shape

**Integration category:** Required for first integration

Your app owns Contentful fetching. The SDK resolver expects a standard single-locale Contentful CDA
entry payload where optimized fields are direct values, not locale-keyed maps.

1. Choose the application Contentful locale in your app configuration, i18n layer, or navigation
   layer.
2. Pass that locale to Contentful CDA requests that feed SDK entry resolution.
3. Request enough link depth for `nt_experiences`, optimization config, and linked variant entries.
   `include: 10` is the repository reference implementation's pattern.
4. Pass the same locale to SDK `locale` when Experience API responses and event context must use the
   same language.
5. Do not pass `contentful.js` `withAllLocales` results or raw CDA `locale=*` responses to
   `OptimizedEntry` or `useEntryResolver`.

**Copy this:**

```tsx
const APP_LOCALE = 'en-US'

const entry = await contentfulClient.getEntry('hero-entry-id', {
  include: 10, // Resolve optimization and variant links before SDK resolution.
  locale: APP_LOCALE, // Keep CDA entries and SDK context on the same locale.
})
```

Changing the provider `locale` prop after initialization calls `sdk.setLocale(nextLocale)`. After
the locale update, Experience API requests and event context use the new locale, but the SDK does
not refetch Contentful entries or refresh profile state. Refetch entries and run your normal
`screen()`, `identify()`, or profile refresh path when localized data must update.

For the entry contract, see
[Entry optimization and variant resolution](../concepts/entry-personalization-and-variant-resolution.md#single-locale-cda-entry-contract).
For the broader locale model, see
[Locale handling in the Optimization SDK Suite](../concepts/locale-handling-in-the-optimization-sdk-suite.md).

### Entry resolution and fallback rendering

**Integration category:** Required for first integration

`OptimizedEntry` resolves the selected Contentful variant for the current profile and passes
non-optimized entries through unchanged. Invalid, incomplete, or unmatched optimization data falls
back to the baseline entry instead of throwing.

1. Pass the baseline Contentful entry to `OptimizedEntry`.
2. Use a render prop when the child needs the resolved baseline or variant entry.
3. Use static children only when you need entry tracking but not variant data in the child.
4. Use `useEntryResolver()` when a component needs the same resolution behavior without the wrapper
   component.

**Adapt this to your use case:**

```tsx
import { OptimizedEntry, useEntryResolver } from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'

function HeroSection({ baselineEntry }: { baselineEntry: Entry }) {
  return (
    <OptimizedEntry baselineEntry={baselineEntry}>
      {(resolvedEntry) => <HeroCard entry={resolvedEntry} />}
    </OptimizedEntry>
  )
}

function HeroData({ baselineEntry }: { baselineEntry: Entry }) {
  const { resolveEntry } = useEntryResolver()
  // resolveEntry uses current selected optimizations and falls back to baseline content.
  const resolvedEntry = resolveEntry(baselineEntry)

  return <HeroCard entry={resolvedEntry} />
}
```

The resolved entry has the same field shape as the baseline entry. Downstream renderers can render
the fields without branching on whether the SDK returned a variant.

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

The default view threshold is 80% visibility for 2000 ms. After the first view event, periodic
duration updates emit every 5000 ms while the entry remains visible. Without
`OptimizationScrollProvider`, the SDK assumes `scrollY` is `0` and uses the screen height as the
viewport, which is appropriate only for non-scrollable or already-visible layouts.

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

The preview panel is an in-app authoring and debugging surface. It fetches `nt_audience` and
`nt_experience` entries through the Contentful client you provide, lets users override audiences and
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
            // Refresh selected optimizations after local preview overrides change.
            void optimization.screen({
              name: 'Preview Refresh',
              properties: {},
              screen: { name: 'Preview Refresh' },
            })
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

1. Create the SDK with `ContentfulOptimization.create(config)`.
2. Pass the instance to `OptimizationProvider sdk={sdk}`.
3. Wrap the tree in the exported `LiveUpdatesProvider` only when preview tooling or global
   live-update state must work without `OptimizationRoot`.
4. Call `destroy()` from the owner when the instance is no longer needed. `OptimizationProvider`
   does not destroy an injected SDK.
5. Do not create a second active React Native SDK instance without destroying the first one.
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
4. Configure `queuePolicy.flush` only when retry, backoff, or circuit-breaker settings need to
   differ from SDK defaults across shared Insights and Experience delivery.
5. Use `api` endpoint overrides and `fetchOptions` for staging, mocks, request timeouts, and retry
   callbacks.

**Adapt this to your use case:**

```tsx
// Empty allow-list means no event emits before explicit consent.
<OptimizationRoot
  clientId="your-optimization-client-id"
  allowedEventTypes={[]}
  onEventBlocked={(blocked) => {
    diagnostics.log('Optimization event blocked', blocked)
  }}
  queuePolicy={{
    // Bound the offline Experience buffer for constrained mobile networks.
    offlineMaxEvents: 50,
    onOfflineDrop: ({ droppedCount }) => {
      diagnostics.log('Dropped offline Experience events', { droppedCount })
    },
  }}
  fetchOptions={{
    requestTimeout: 3000,
    retries: 1,
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
4. For Android local mocks, rewrite host `localhost` URLs to the emulator host alias from
   application configuration.
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

## Reference implementations to compare against

- [React Native reference implementation](../../implementations/react-native-sdk/README.md) - The
  in-tree React Native app that demonstrates provider setup, consent bootstrap, CDA locale handling,
  optimized entry rendering, scroll provider usage, tap tracking, navigation tracking, live updates,
  preview panel behavior, offline behavior, and Detox E2E coverage.
