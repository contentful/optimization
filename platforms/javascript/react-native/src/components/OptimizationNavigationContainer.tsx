import { createScopedLogger, type Properties } from '@contentful/optimization-core'
import type React from 'react'
import { useCallback, useRef } from 'react'
import * as z from 'zod/mini'
import { useOptimization } from '../context/OptimizationContext'

const logger = createScopedLogger('RN:Navigation')

/**
 * Converts route params to JSON-safe format using Zod validation.
 * React Navigation params are JSON-serializable by contract.
 */
function paramsToJson(params: Record<string, unknown>): z.core.util.JSONType {
  return z.json().parse(JSON.parse(JSON.stringify(params)))
}

/**
 * Navigation state type from React Navigation.
 * This is a minimal type definition to avoid requiring @react-navigation/native as a dependency.
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
 * Ref type for the navigation container.
 * This is a minimal type definition to avoid requiring @react-navigation/native as a dependency.
 */
interface NavigationContainerRef {
  getCurrentRoute: () => { name: string; params?: Record<string, unknown> } | undefined
}

/**
 * Props for OptimizationNavigationContainer
 *
 * @public
 */
export interface OptimizationNavigationContainerProps {
  /**
   * Function to render the NavigationContainer.
   * Receives props that should be spread onto the NavigationContainer.
   */
  children: (props: {
    ref: React.RefObject<NavigationContainerRef>
    onReady: () => void
    onStateChange: (state: NavigationState | undefined) => void
  }) => React.ReactNode

  /**
   * Optional callback called when the navigation state changes.
   * Called after screen tracking is performed.
   */
  onStateChange?: (state: NavigationState | undefined) => void

  /**
   * Optional callback called when the navigation container is ready.
   * Called after the initial screen is tracked.
   */
  onReady?: () => void

  /**
   * Whether to include route params in the screen event properties.
   * @default false
   */
  includeParams?: boolean
}

/**
 * Wrapper component that provides automatic screen tracking for React Navigation.
 *
 * This component uses a render prop pattern to wrap React Navigation's NavigationContainer
 * and automatically track screen views when the active route changes.
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
  const optimization = useOptimization()
  const navigationRef = useRef<NavigationContainerRef>(null)
  const routeNameRef = useRef<string | undefined>(undefined)

  // Store optimization in a ref to prevent unnecessary callback recreations
  const optimizationRef = useRef(optimization)
  optimizationRef.current = optimization

  const trackScreen = useCallback(
    (screenName: string, params?: Record<string, unknown>) => {
      const { current: currentOptimization } = optimizationRef

      const properties: Properties = includeParams && params ? { params: paramsToJson(params) } : {}

      logger.info(`Tracking screen: "${screenName}"`)

      void currentOptimization.screen({
        name: screenName,
        properties,
        screen: { name: screenName },
      })
    },
    [includeParams],
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
