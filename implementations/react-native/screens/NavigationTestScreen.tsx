import { OptimizationNavigationContainer } from '@contentful/optimization-react-native'
import type { NavigationContainerRef } from '@react-navigation/native'
import { NavigationContainer } from '@react-navigation/native'
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack'
import React, { useRef } from 'react'
import { Button, View } from 'react-native'
import type {
  NavigationTestScreenProps,
  NavigationTestStackParamList,
} from '../types/navigationTypes'
import { adaptNavigationState, toRecord } from '../utils/navigationHelpers'
import { ImplementationNavigationView } from './ImplementationNavigationView'
import { NavigationHome } from './NavigationHome'

const Stack = createNativeStackNavigator<NavigationTestStackParamList>()

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
              <Stack.Screen name="NavigationViewOne">
                {({
                  navigation,
                }: {
                  navigation: NativeStackNavigationProp<
                    NavigationTestStackParamList,
                    'NavigationViewOne'
                  >
                }) => (
                  <ImplementationNavigationView
                    testIdSuffix="one"
                    onNavigateNext={() => {
                      navigation.navigate('NavigationViewTwo')
                    }}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="NavigationViewTwo">
                {() => <ImplementationNavigationView testIdSuffix="two" />}
              </Stack.Screen>
            </Stack.Navigator>
          </NavigationContainer>
        )}
      </OptimizationNavigationContainer>
    </View>
  )
}
