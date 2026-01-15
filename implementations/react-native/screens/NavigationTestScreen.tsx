import { OptimizationNavigationContainer } from '@contentful/optimization-react-native'
import type {
  NavigationContainerRef,
  NavigationState,
  ParamListBase,
} from '@react-navigation/native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import React, { useRef } from 'react'
import { Button, View } from 'react-native'

interface NavigationTestStackParamList extends ParamListBase {
  NavigationHome: undefined
  NavigationViewOne: undefined
}

const Stack = createNativeStackNavigator<NavigationTestStackParamList>()

function NavigationHome({
  navigation,
}: {
  navigation: { navigate: (screen: keyof NavigationTestStackParamList) => void }
}): React.JSX.Element {
  return (
    <View>
      <Button
        testID="go-to-view-one-button"
        title="Go to View One"
        onPress={() => {
          navigation.navigate('NavigationViewOne')
        }}
      />
    </View>
  )
}

function NavigationViewOne(): React.JSX.Element {
  return <View testID="navigation-view-one" />
}

interface NavigationTestScreenProps {
  onClose: () => void
}

function toRecord(params: object | undefined): Record<string, unknown> | undefined {
  if (!params) return undefined
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) {
    result[key] = value
  }
  return result
}

function adaptNavigationState(
  state: NavigationState | undefined,
):
  | {
      index: number
      routes: Array<{ name: string; key: string; params?: Record<string, unknown> }>
    }
  | undefined {
  if (!state) return undefined
  return {
    index: state.index,
    routes: state.routes.map((route) => ({
      name: route.name,
      key: route.key,
      params: toRecord(route.params),
    })),
  }
}

export function NavigationTestScreen({ onClose }: NavigationTestScreenProps): React.JSX.Element {
  const navigationRef = useRef<NavigationContainerRef<NavigationTestStackParamList>>(null)

  return (
    <View style={{ flex: 1 }}>
      <View>
        <Button testID="close-navigation-test-button" title="Close" onPress={onClose} />
      </View>
      <OptimizationNavigationContainer>
        {(navigationProps) => (
          <NavigationContainer
            independent
            ref={navigationRef}
            onReady={() => {
              const route = navigationRef.current?.getCurrentRoute()
              if (route) {
                Object.assign(navigationProps.ref, {
                  current: {
                    getCurrentRoute: () => ({
                      name: route.name,
                      params: toRecord(route.params),
                    }),
                  },
                })
              }
              navigationProps.onReady()
            }}
            onStateChange={(state) => {
              const route = navigationRef.current?.getCurrentRoute()
              if (route) {
                Object.assign(navigationProps.ref, {
                  current: {
                    getCurrentRoute: () => ({
                      name: route.name,
                      params: toRecord(route.params),
                    }),
                  },
                })
              }
              navigationProps.onStateChange(adaptNavigationState(state))
            }}
          >
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="NavigationHome" component={NavigationHome} />
              <Stack.Screen name="NavigationViewOne" component={NavigationViewOne} />
            </Stack.Navigator>
          </NavigationContainer>
        )}
      </OptimizationNavigationContainer>
    </View>
  )
}
