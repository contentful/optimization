import React from 'react'
import { Button, View } from 'react-native'
import type { NavigationTestStackParamList } from '../types/navigationTypes'

interface NavigationHomeProps {
  navigation: { navigate: (screen: keyof NavigationTestStackParamList) => void }
}

export function NavigationHome({ navigation }: NavigationHomeProps): React.JSX.Element {
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
