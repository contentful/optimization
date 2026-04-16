# Integrating the Optimization React Native SDK in a React Native App

Use this guide when you want to add personalization, analytics, screen tracking, and a preview panel
to a React Native (or Expo) application using `@contentful/optimization-react-native`.

The React Native SDK builds on the Optimization Core Library and adds React Native-specific
providers, hooks, and components — including AsyncStorage persistence, viewport-based view tracking,
tap tracking, screen tracking, navigation integration, and an in-app preview panel.

## A Reference App You Can Compare Against

The
`[Colorful-Team-Org/ReactNativeOptimizationDemo](https://github.com/Colorful-Team-Org/ReactNativeOptimizationDemo)`
repository contains two side-by-side Expo apps that implement the exact same UI from the same
Contentful space:

| App                       | What it shows                                                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ContentfulDemoBase`      | Plain Contentful Delivery API integration. Every user sees the same content.                                                                                |
| `ContentfulDemoOptimized` | The same UI, converted to use `@contentful/optimization-react-native`. Adds personalization, view/tap tracking, screen tracking, and the preview panel FAB. |

Diffing the two apps is the fastest way to see what an Optimization integration actually changes.
Throughout this guide, "demo" refers to `ContentfulDemoOptimized`, and file paths point to that
project (e.g. `ContentfulDemoOptimized/App.tsx`).

The demo focuses on these conversion points:

- `App.tsx` — wrapping the navigation tree in `OptimizationRoot` and
  `OptimizationNavigationContainer`.
- `src/screens/HomeScreen.tsx` — wrapping a CTA entry in `<OptimizedEntry>` for personalization and
  wrapping each blog post card for tap/view tracking.
- `src/screens/BlogPostDetailScreen.tsx` — wrapping a scrollable screen in
  `<OptimizationScrollProvider>` so viewport-based view tracking reflects scroll position.
- `src/contentfulClient.ts` — a normal Contentful Delivery API client; the Optimization SDK does not
  replace it, it sits alongside it.

## The Integration Flow

Most React Native integrations follow this sequence:

1. Install the SDK and its required peer dependencies.
2. Wrap the app in `OptimizationRoot` with the minimum config (`clientId`).
3. Decide how consent should behave (default-on for trusted contexts, or gated by a UI prompt).
4. Wrap each personalizable Contentful entry in `<OptimizedEntry>`.
5. Enable view and/or tap tracking for the entries you care about.
6. Wrap scrollable screens in `<OptimizationScrollProvider>` so viewport tracking is accurate.
7. Add screen tracking (either automatically via `OptimizationNavigationContainer` or per-screen
   with `useScreenTracking`).
8. Optionally enable the preview panel for development builds.

Table of Contents

- [A Reference App You Can Compare Against](#a-reference-app-you-can-compare-against)
- [The Integration Flow](#the-integration-flow)
- [1. Install And Initialize With Minimal Configuration](#1-install-and-initialize-with-minimal-configuration)
  - [Install Peer Dependencies](#install-peer-dependencies)
  - [The Minimum Setup](#the-minimum-setup)
  - [Access The SDK Instance With Hooks](#access-the-sdk-instance-with-hooks)
- [2. Handle Consent](#2-handle-consent)
  - [Defaulting Consent To `true](#defaulting-consent-to-true)`
  - [Gating Consent On A Banner](#gating-consent-on-a-banner)
  - [Reading And Reacting To Consent State](#reading-and-reacting-to-consent-state)
  - [Revoking Consent](#revoking-consent)
- [3. Personalize Entries With OptimizedEntry](#3-personalize-entries-with-optimizedentry)
  - [Fetch The Entry With `include: 10](#fetch-the-entry-with-include-10)`
  - [Render The Variant With A Render Prop](#render-the-variant-with-a-render-prop)
  - [Pass-Through For Non-Optimized Entries](#pass-through-for-non-optimized-entries)
- [4. Interaction Tracking With OptimizedEntry](#4-interaction-tracking-with-optimizedentry)
  - [Global Defaults Via OptimizationRoot](#global-defaults-via-optimizationroot)
  - [Per-Component Overrides](#per-component-overrides)
  - [Custom Visibility And Time Thresholds](#custom-visibility-and-time-thresholds)
  - [Use OptimizationScrollProvider For Scrollable Screens](#use-optimizationscrollprovider-for-scrollable-screens)
- [5. Enabling And Disabling Live Updates](#5-enabling-and-disabling-live-updates)
  - [Default Behavior](#default-behavior)
  - [Global Live Updates](#global-live-updates)
  - [Per-Component Live Updates](#per-component-live-updates)
  - [Resolution Priority](#resolution-priority)
- [6. Screen Tracking](#6-screen-tracking)
  - [Automatic Tracking With OptimizationNavigationContainer](#automatic-tracking-with-optimizationnavigationcontainer)
  - [Per-Screen Tracking With `useScreenTracking](#per-screen-tracking-with-usescreentracking)`
  - [Dynamic Names With `useScreenTrackingCallback](#dynamic-names-with-usescreentrackingcallback)`
- [7. Preview Panel](#7-preview-panel)
  - [Enabling The Preview Panel](#enabling-the-preview-panel)
  - [Customizing The Floating Action Button](#customizing-the-floating-action-button)
  - [Preview Panel And Live Updates](#preview-panel-and-live-updates)
- [Reference Implementations To Compare Against](#reference-implementations-to-compare-against)

## 1. Install And Initialize With Minimal Configuration

### Install Peer Dependencies

```sh
pnpm add @contentful/optimization-react-native @react-native-async-storage/async-storage
```

For offline support (recommended), also install:

```sh
pnpm add @react-native-community/netinfo
```

The SDK uses AsyncStorage to persist consent, profile, and selected optimizations across app
launches. `netinfo` is optional but lets the SDK queue events while the device is offline and flush
them automatically when connectivity returns.

> [!NOTE] The Optimization SDK depends on native modules (e.g. `@react-native-clipboard/clipboard`
> for the preview panel). Expo apps using Optimization need a custom dev build (`expo run:ios` /
> `expo run:android`) — Expo Go is not enough. The demo's `[ContentfulDemoOptimized` README
> section](https://github.com/Colorful-Team-Org/ReactNativeOptimizationDemo#setup) walks through
> `expo prebuild` and the resulting native build.

### The Minimum Setup

Wrap your app's root in `<OptimizationRoot>`. This is the recommended entry point — it composes the
`OptimizationProvider`, `LiveUpdatesProvider`, and `InteractionTrackingProvider` for you and manages
the SDK instance lifecycle.

```tsx
import { OptimizationRoot } from '@contentful/optimization-react-native'

export default function App() {
  return (
    <OptimizationRoot clientId="your-client-id">
      <YourApp />
    </OptimizationRoot>
  )
}
```

That is the minimum viable setup. `clientId` is the only required prop; everything else falls back
to safe defaults (environment defaults to `'main'`, channel to `'mobile'`, etc.).

The demo's
`[ContentfulDemoOptimized/App.tsx](https://github.com/Colorful-Team-Org/ReactNativeOptimizationDemo/blob/main/ContentfulDemoOptimized/App.tsx)`
shows a more typical setup that adds the navigation container, a defaults block, and the preview
panel:

```tsx
<OptimizationRoot
  clientId={OPTIMIZATION_CLIENT_ID}
  environment={OPTIMIZATION_ENVIRONMENT}
  logLevel={__DEV__ ? 'info' : 'warn'}
  defaults={{ consent: true }}
  previewPanel={{
    enabled: __DEV__,
    contentfulClient: client,
  }}
>
  <OptimizationNavigationContainer>
    {(navigationProps) => (
      <NavigationContainer {...navigationProps}>
        {/* ...stack/tab navigators... */}
      </NavigationContainer>
    )}
  </OptimizationNavigationContainer>
</OptimizationRoot>
```

Common props on `OptimizationRoot`:

| Prop                    | Type                         | Required | Default                        | Description                                                             |
| ----------------------- | ---------------------------- | -------- | ------------------------------ | ----------------------------------------------------------------------- |
| `clientId`              | `string`                     | Yes      | N/A                            | Your Contentful Optimization client identifier                          |
| `environment`           | `string`                     | No       | `'main'`                       | Optimization environment to read from                                   |
| `defaults`              | `{ consent?: boolean, ... }` | No       | `undefined`                    | Initial values applied at startup (e.g. `consent: true`)                |
| `logLevel`              | `LogLevels`                  | No       | `'error'`                      | Minimum console log level                                               |
| `previewPanel`          | `PreviewPanelConfig`         | No       | `undefined`                    | Enables the in-app preview panel; see [Preview Panel](#7-preview-panel) |
| `liveUpdates`           | `boolean`                    | No       | `false`                        | Global live-updates default for `<OptimizedEntry />`                    |
| `trackEntryInteraction` | `{ views?, taps? }`          | No       | `{ views: true, taps: false }` | Default interaction tracking for `<OptimizedEntry />`                   |

The full configuration reference (API endpoints, fetch retries, queue policy, event-builder
overrides) is documented in the
[React Native SDK README](../packages/react-native-sdk/README.md#configuration).

### Access The SDK Instance With Hooks

Inside the provider tree, use `useOptimization()` to interact with the SDK directly:

```tsx
import { useOptimization } from '@contentful/optimization-react-native'

function MyComponent() {
  const optimization = useOptimization()

  const handlePress = async () => {
    await optimization.identify('user-123', { plan: 'pro' })
  }

  return <Button onPress={handlePress} title="Identify" />
}
```

`useOptimization()` throws if used outside an `OptimizationProvider` / `OptimizationRoot`, and is
guaranteed to return a ready SDK instance — `OptimizationProvider` does not render its children
until the SDK has finished initializing.

## 2. Handle Consent

The SDK gates non-essential event types behind a consent state. By default, only `identify` and
`screen` events are allowed before consent is explicitly set. All other event types (including entry
view/tap tracking) are blocked until the user accepts or rejects consent.

You can change which event types are permitted before consent via the `allowedEventTypes` config
option.

### Defaulting Consent To `true`

If your app already collects consent at install time (e.g. through a prior onboarding flow) or if
you don't need a runtime consent prompt, set `defaults.consent: true` so events flow immediately:

```tsx
<OptimizationRoot clientId="your-client-id" defaults={{ consent: true }}>
  <YourApp />
</OptimizationRoot>
```

This is what the demo does — see
`[ContentfulDemoOptimized/App.tsx](https://github.com/Colorful-Team-Org/ReactNativeOptimizationDemo/blob/main/ContentfulDemoOptimized/App.tsx#L29)`.
The default is applied once at startup; user input later takes precedence.

### Gating Consent On A Banner

For apps that need an explicit prompt, leave `defaults.consent` unset and call `consent()` from your
banner UI:

```tsx
import { useOptimization } from '@contentful/optimization-react-native'
import { View, Text, Button } from 'react-native'

function ConsentBanner() {
  const optimization = useOptimization()

  return (
    <View>
      <Text>We use cookies for personalization.</Text>
      <Button title="Accept" onPress={() => optimization.consent(true)} />
      <Button title="Reject" onPress={() => optimization.consent(false)} />
    </View>
  )
}
```

When consent is accepted (`true`), all event types are permitted. When consent is rejected
(`false`), non-allowed event types are blocked and `<OptimizedEntry />` view/tap tracking will be
silently dropped at the SDK boundary. Consent state persists across app launches via AsyncStorage.

### Reading And Reacting To Consent State

Subscribe to the SDK's consent observable when you need to render UI conditionally:

```tsx
import { useOptimization } from '@contentful/optimization-react-native'
import { useEffect, useState } from 'react'
import { Text } from 'react-native'

function ConsentStatus() {
  const optimization = useOptimization()
  const [consent, setConsent] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    const sub = optimization.states.consent.subscribe(setConsent)
    return () => sub.unsubscribe()
  }, [optimization])

  return <Text>Consent: {String(consent)}</Text>
}
```

A common pattern is to gate personalized content rendering on consent and fall back to the baseline
entry while consent is missing or rejected.

### Revoking Consent

To revoke consent after it was previously accepted, just call `consent(false)`:

```tsx
optimization.consent(false)
```

## 3. Personalize Entries With OptimizedEntry

`<OptimizedEntry />` is the unified component for resolving optimized variants and tracking
interactions on Contentful entries. It:

- Detects whether the entry has `nt_experiences` (i.e. is optimized) and resolves the correct
  variant for the current user profile.
- Passes non-optimized entries through unchanged (so you can blanket-wrap a list and only the
  optimized entries actually personalize).
- Emits view tracking when the entry crosses the visibility/time threshold.
- Emits tap tracking when enabled.

### Fetch The Entry With `include: 10`

For variant data to resolve, the entry must be fetched with linked optimization references included.
Use `include: 10` on Contentful's Delivery API call:

```tsx
const cta = await contentfulClient.getEntry(CTA_ENTRY_ID, { include: 10 })
```

The demo's
`[HomeScreen.tsx](https://github.com/Colorful-Team-Org/ReactNativeOptimizationDemo/blob/main/ContentfulDemoOptimized/src/screens/HomeScreen.tsx)`
fetches the CTA exactly this way, in parallel with the unoptimized blog-post list.

### Render The Variant With A Render Prop

Pass the baseline entry to `<OptimizedEntry>` and render with a render prop that receives the
resolved entry:

```tsx
import { OptimizedEntry } from '@contentful/optimization-react-native'

function HeroSection({ baselineEntry }) {
  return (
    <OptimizedEntry entry={baselineEntry}>
      {(resolvedEntry) => <CTAHeader entry={resolvedEntry} />}
    </OptimizedEntry>
  )
}
```

`resolvedEntry` is either the resolved variant (when the SDK has selected one for the current
profile) or the baseline entry (when no variant qualifies). Either way, `resolvedEntry.fields` has
the same shape as the baseline — so the renderer downstream doesn't need to know whether it's seeing
a variant or not.

### Pass-Through For Non-Optimized Entries

When you only want to track an entry (no variant resolution), pass static children instead of a
render prop:

```tsx
<OptimizedEntry entry={blogPost}>
  <BlogPostCard post={blogPost} onPress={...} />
</OptimizedEntry>
```

This is exactly the pattern the demo uses for its blog-post list — every card is wrapped so the SDK
can track views/taps, but the content itself doesn't change per user. See
`[HomeScreen.tsx](https://github.com/Colorful-Team-Org/ReactNativeOptimizationDemo/blob/main/ContentfulDemoOptimized/src/screens/HomeScreen.tsx)`.

## 4. Interaction Tracking With OptimizedEntry

`<OptimizedEntry />` tracks two interactions: **views** (the entry was at least N% visible for at
least M ms) and **taps** (the user tapped the entry). View tracking is enabled by default; tap
tracking is opt-in.

### Global Defaults Via OptimizationRoot

Set a global default for all `<OptimizedEntry />` components via `trackEntryInteraction` on the
root:

```tsx
<OptimizationRoot clientId="your-client-id" trackEntryInteraction={{ views: true, taps: true }}>
  <YourApp />
</OptimizationRoot>
```

The default is `{ views: true, taps: false }`.

### Per-Component Overrides

Override the global setting on individual entries with `trackViews` and `trackTaps`:

```tsx
{
  /* Track taps on this CTA, regardless of global setting */
}
;<OptimizedEntry entry={cta} trackTaps>
  {(resolved) => <CTAHeader entry={resolved} />}
</OptimizedEntry>

{
  /* Disable view tracking for a high-frequency entry */
}
;<OptimizedEntry entry={feedItem} trackViews={false}>
  <FeedItemCard item={feedItem} />
</OptimizedEntry>
```

You can also pass `onTap` to receive the resolved entry after a tap is tracked. Providing `onTap`
implicitly enables tap tracking unless `trackTaps={false}` is explicit:

```tsx
<OptimizedEntry
  entry={cta}
  onTap={(resolved) => navigation.navigate('CTA', { id: resolved.sys.id })}
>
  {(resolved) => <CTAHeader entry={resolved} />}
</OptimizedEntry>
```

### Custom Visibility And Time Thresholds

By default, view tracking fires when the entry is **80% visible for 2000 ms**. Customize per-entry:

```tsx
<OptimizedEntry
  entry={hero}
  threshold={0.5} // 50% visible
  viewTimeMs={1000} // for 1 second
>
  {(resolved) => <Hero entry={resolved} />}
</OptimizedEntry>
```

After the initial view event, the SDK emits periodic view-duration update events every 5000 ms by
default; configure with `viewDurationUpdateIntervalMs`.

### Use OptimizationScrollProvider For Scrollable Screens

Inside a scrolling container, viewport-based view tracking needs to know the actual scroll position.
Wrap the scrollable screen in `<OptimizationScrollProvider>`:

```tsx
import { OptimizationScrollProvider, OptimizedEntry } from '@contentful/optimization-react-native'

function BlogPostDetailScreen({ post }) {
  return (
    <OptimizationScrollProvider>
      <OptimizedEntry entry={post}>
        <ArticleBody post={post} />
      </OptimizedEntry>
    </OptimizationScrollProvider>
  )
}
```

The demo's
`[BlogPostDetailScreen.tsx](https://github.com/Colorful-Team-Org/ReactNativeOptimizationDemo/blob/main/ContentfulDemoOptimized/src/screens/BlogPostDetailScreen.tsx)`
shows this exactly.

Without `OptimizationScrollProvider`, the SDK assumes scroll position is always `0` and the viewport
equals the screen. That's fine for a single full-screen component, but for content that appears
below the fold, wrap the screen so tracking fires when the user scrolls the entry into view.

## 5. Enabling And Disabling Live Updates

### Default Behavior

By default, `<OptimizedEntry />` **locks to the first variant it receives** for the lifetime of the
component. If a user later qualifies for a different variant mid-session (e.g. after `identify()`),
they continue to see the original variant until the component unmounts. This prevents UI flashing
when audience membership changes while the user is viewing content.

### Global Live Updates

Set `liveUpdates` on `OptimizationRoot` to enable real-time updates for every `<OptimizedEntry />`
in the app:

```tsx
<OptimizationRoot clientId="your-client-id" liveUpdates>
  <YourApp />
</OptimizationRoot>
```

### Per-Component Live Updates

Override the global setting on individual entries:

```tsx
{
  /* Always reacts to changes immediately */
}
;<OptimizedEntry entry={dashboard} liveUpdates>
  {(resolved) => <Dashboard entry={resolved} />}
</OptimizedEntry>

{
  /* Locks to first variant, even if global liveUpdates is true */
}
;<OptimizedEntry entry={hero} liveUpdates={false}>
  {(resolved) => <Hero entry={resolved} />}
</OptimizedEntry>

{
  /* Inherits the global setting */
}
;<OptimizedEntry entry={banner}>{(resolved) => <Banner entry={resolved} />}</OptimizedEntry>
```

### Resolution Priority

The effective live-updates state for a given `<OptimizedEntry />` is resolved in this order (highest
to lowest priority):

1. **Preview panel open** — always forces live updates on (cannot be overridden).
2. **Component `liveUpdates` prop** — explicit per-component override.
3. `**OptimizationRoot` `liveUpdates` prop\*\* — global setting.
4. **Default** — locked to first variant (`false`).

| Preview Panel | Global Setting | Component Prop | Result           |
| ------------- | -------------- | -------------- | ---------------- |
| Open          | any            | any            | Live updates ON  |
| Closed        | `true`         | `undefined`    | Live updates ON  |
| Closed        | `false`        | `true`         | Live updates ON  |
| Closed        | `true`         | `false`        | Live updates OFF |
| Closed        | `false`        | `undefined`    | Live updates OFF |

To read the current state programmatically, use `useLiveUpdates()`:

```tsx
import { useLiveUpdates } from '@contentful/optimization-react-native'

function StatusBadge() {
  const liveUpdates = useLiveUpdates()
  const isLive = liveUpdates?.globalLiveUpdates ?? false
  return <Text>{isLive ? 'Live' : 'Locked'}</Text>
}
```

## 6. Screen Tracking

Screen tracking emits a `screen` event each time the user navigates to a new screen. The SDK uses
these events to update profile attribution and route-aware properties.

### Automatic Tracking With OptimizationNavigationContainer

If you use React Navigation, the easiest setup is `<OptimizationNavigationContainer />`, which wraps
`<NavigationContainer />` and emits a `screen` event on every active route change:

```tsx
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import {
  OptimizationRoot,
  OptimizationNavigationContainer,
} from '@contentful/optimization-react-native'

const Stack = createNativeStackNavigator()

export default function App() {
  return (
    <OptimizationRoot clientId="your-client-id">
      <OptimizationNavigationContainer>
        {(navigationProps) => (
          <NavigationContainer {...navigationProps}>
            <Stack.Navigator>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="BlogPostDetail" component={BlogPostDetailScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        )}
      </OptimizationNavigationContainer>
    </OptimizationRoot>
  )
}
```

This is the pattern in the demo's
`[App.tsx](https://github.com/Colorful-Team-Org/ReactNativeOptimizationDemo/blob/main/ContentfulDemoOptimized/App.tsx)`.
The render-prop pattern means the wrapper does not depend on `@react-navigation/native` directly —
navigation props are passed through to your real `NavigationContainer`.

Available props:

| Prop            | Required | Default | Description                                                    |
| --------------- | -------- | ------- | -------------------------------------------------------------- |
| `children`      | Yes      | N/A     | Render prop receiving `ref`, `onReady`, and `onStateChange`    |
| `onStateChange` | No       | —       | Called after screen tracking fires on navigation state changes |
| `onReady`       | No       | —       | Called after the initial screen tracking on container ready    |
| `includeParams` | No       | `false` | Whether to include route params in the screen event properties |

### Per-Screen Tracking With `useScreenTracking`

If you don't use React Navigation, or if you want fine-grained control, call `useScreenTracking`
inside each screen component:

```tsx
import { useScreenTracking } from '@contentful/optimization-react-native'

function HomeScreen() {
  useScreenTracking({ name: 'Home' })
  return <View>...</View>
}
```

By default this fires once on mount. To delay tracking until data is loaded, pass
`trackOnMount: false` and call `trackScreen()` manually:

```tsx
function DetailsScreen() {
  const { trackScreen } = useScreenTracking({
    name: 'Details',
    trackOnMount: false,
  })

  useEffect(() => {
    if (dataLoaded) {
      void trackScreen()
    }
  }, [dataLoaded, trackScreen])

  return <View>...</View>
}
```

### Dynamic Names With `useScreenTrackingCallback`

When the screen name isn't known at render time (e.g. derived from navigation state or a deep-link),
use `useScreenTrackingCallback` to get a stable callback you can fire on demand:

```tsx
import { useScreenTrackingCallback } from '@contentful/optimization-react-native'

function DynamicScreen({ screenName }: { screenName: string }) {
  const trackScreenView = useScreenTrackingCallback()

  useEffect(() => {
    trackScreenView(screenName, { source: 'deep-link' })
  }, [screenName, trackScreenView])

  return <View>...</View>
}
```

## 7. Preview Panel

The preview panel is an in-app developer surface that lets you browse audiences, override variant
selection, and inspect the current profile — all without modifying real user data. It's the React
Native counterpart to the Web preview panel.

### Enabling The Preview Panel

Pass a `previewPanel` config to `OptimizationRoot`. You must also pass an initialized Contentful
client so the panel can fetch audience and experience entries:

```tsx
import { OptimizationRoot } from '@contentful/optimization-react-native'
import { createClient } from 'contentful'

const contentfulClient = createClient({
  space: 'your-space-id',
  accessToken: 'your-delivery-token',
  environment: 'main',
})

export default function App() {
  return (
    <OptimizationRoot
      clientId="your-client-id"
      previewPanel={{
        enabled: __DEV__,
        contentfulClient,
      }}
    >
      <YourApp />
    </OptimizationRoot>
  )
}
```

With `enabled: true`, a floating action button appears on top of your app. Tap it to open the panel
drawer.

The demo enables the panel unconditionally (toggled by a const in `App.tsx`). For real apps, gate on
`__DEV__` (or another build flag) so the FAB doesn't appear in production.

### Customizing The Floating Action Button

Use `fabPosition` and `showHeader` to fine-tune placement and chrome:

```tsx
<OptimizationRoot
  clientId="your-client-id"
  previewPanel={{
    enabled: __DEV__,
    contentfulClient,
    fabPosition: { bottom: 50, right: 20 },
    showHeader: true,
    onVisibilityChange: (visible) => console.log('preview panel visible:', visible),
  }}
>
  <YourApp />
</OptimizationRoot>
```

### Preview Panel And Live Updates

When the preview panel is open, **all** `<OptimizedEntry />` components automatically enable live
updates, regardless of their `liveUpdates` prop or the global setting. This is what makes "override
audience → see variant change immediately" work in the panel without a screen reload.

You can read the current panel visibility via `useLiveUpdates()`:

```tsx
import { useLiveUpdates } from '@contentful/optimization-react-native'

function DebugBadge() {
  const liveUpdates = useLiveUpdates()
  return <Text>Preview panel: {liveUpdates?.previewPanelVisible ? 'open' : 'closed'}</Text>
}
```

## Reference Implementations To Compare Against

- `[Colorful-Team-Org/ReactNativeOptimizationDemo](https://github.com/Colorful-Team-Org/ReactNativeOptimizationDemo)`
  — two side-by-side Expo apps (`ContentfulDemoBase` and `ContentfulDemoOptimized`) that demonstrate
  converting a plain Contentful app into an Optimization-powered one. Diffing the two apps is the
  fastest way to see the actual integration delta.
- `[implementations/react-native-sdk](../implementations/react-native-sdk/README.md)` — the in-tree
  reference implementation that is built and tested alongside the SDK itself. Useful when you want
  to see the SDK exercised against the latest API surface.
