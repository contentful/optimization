import type { Properties } from '@contentful/optimization-core/api-schemas'
import type React from 'react'
import { useCallback, useRef } from 'react'
import * as z from 'zod/mini'
import { useScreenTrackingCallback } from '../hooks/useScreenTracking'

/**
 * @internal
 */
function paramsToJson(params: Record<string, unknown>): z.core.util.JSONType {
  return z.json().parse(JSON.parse(JSON.stringify(params)))
}

/**
 * @internal
 */
interface NavigationState {
  index: number
  routes: Array<{
    name: string
    key: string
    params?: Record<string, unknown>
  }>
}

/**
 * @internal
 */
interface NavigationContainerRef {
  getCurrentRoute: () => { name: string; params?: Record<string, unknown> } | undefined
}

/**
 * Props for the {@link OptimizationNavigationContainer} component.
 *
 * @public
 */
export interface OptimizationNavigationContainerProps {
  /**
   * Render prop that receives navigation props to spread onto the `NavigationContainer`.
   */
  children: (props: {
    ref: React.RefObject<NavigationContainerRef | null>
    onReady: () => void
    onStateChange: (state: NavigationState | undefined) => void
  }) => React.ReactNode

  /**
   * Optional callback called when the navigation state changes.
   * Invoked after screen tracking is performed.
   */
  onStateChange?: (state: NavigationState | undefined) => void

  /**
   * Optional callback called when the navigation container is ready.
   * Invoked after the initial screen is tracked.
   */
  onReady?: () => void

  /**
   * Whether to include route params in the screen event properties.
   *
   * @defaultValue false
   */
  includeParams?: boolean
}

/**
 * Wraps React Navigation's `NavigationContainer` to automatically track screen views
 * when the active route changes.
 *
 * @param props - Component props
 * @returns The rendered children with tracking callbacks injected
 *
 * @remarks
 * Must be used within an {@link OptimizationProvider}. Uses a render prop pattern so
 * that navigation props (`ref`, `onReady`, `onStateChange`) can be spread onto the
 * `NavigationContainer` without requiring a direct dependency on `@react-navigation/native`.
 *
 * @example
 * ```tsx
 * import { NavigationContainer } from '@react-navigation/native'
 * import { createNativeStackNavigator } from '@react-navigation/native-stack'
 * import { OptimizationNavigationContainer, OptimizationProvider } from '@contentful/optimization-react-native'
 *
 * const Stack = createNativeStackNavigator()
 *
 * function App() {
 *   return (
 *     <OptimizationProvider instance={optimization}>
 *       <OptimizationNavigationContainer>
 *         {(navigationProps) => (
 *           <NavigationContainer {...navigationProps}>
 *             <Stack.Navigator>
 *               <Stack.Screen name="Home" component={HomeScreen} />
 *               <Stack.Screen name="Details" component={DetailsScreen} />
 *             </Stack.Navigator>
 *           </NavigationContainer>
 *         )}
 *       </OptimizationNavigationContainer>
 *     </OptimizationProvider>
 *   )
 * }
 * ```
 *
 * @public
 */
export function OptimizationNavigationContainer({
  children,
  onStateChange: userOnStateChange,
  onReady: userOnReady,
  includeParams = false,
}: OptimizationNavigationContainerProps): React.ReactNode {
  const trackScreenView = useScreenTrackingCallback()
  const navigationRef = useRef<NavigationContainerRef>(null)
  const routeNameRef = useRef<string | undefined>(undefined)

  const trackScreen = useCallback(
    (screenName: string, params?: Record<string, unknown>) => {
      const properties: Properties = {
        name: screenName,
        ...(includeParams && params ? { params: paramsToJson(params) } : {}),
      }

      trackScreenView(screenName, properties)
    },
    [includeParams, trackScreenView],
  )

  const handleReady = useCallback(() => {
    const currentRoute = navigationRef.current?.getCurrentRoute()

    if (currentRoute) {
      const { name: initialRouteName, params } = currentRoute
      routeNameRef.current = initialRouteName
      trackScreen(initialRouteName, params)
    }

    userOnReady?.()
  }, [trackScreen, userOnReady])

  const handleStateChange = useCallback(
    (state: NavigationState | undefined) => {
      const { current: previousRouteName } = routeNameRef
      const currentRoute = navigationRef.current?.getCurrentRoute()

      if (currentRoute) {
        const { name: currentRouteName, params } = currentRoute

        if (previousRouteName !== currentRouteName) {
          trackScreen(currentRouteName, params)
        }

        routeNameRef.current = currentRouteName
      }

      userOnStateChange?.(state)
    },
    [trackScreen, userOnStateChange],
  )

  return children({
    ref: navigationRef,
    onReady: handleReady,
    onStateChange: handleStateChange,
  })
}
