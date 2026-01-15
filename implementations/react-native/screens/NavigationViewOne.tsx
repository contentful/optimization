import { useOptimization } from '@contentful/optimization-react-native'
import React, { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import type { ScreenViewEvent } from '../types/navigationTypes'
import { isScreenViewEvent } from '../utils/navigationHelpers'

export function NavigationViewOne(): React.JSX.Element {
  const optimization = useOptimization()
  const [lastScreenEvent, setLastScreenEvent] = useState<ScreenViewEvent | null>(null)

  useEffect(() => {
    const subscription = optimization.states.eventStream.subscribe((event: unknown) => {
      if (isScreenViewEvent(event)) {
        setLastScreenEvent(event)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [optimization])

  return (
    <View
      testID="navigation-view-one"
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
    >
      <Text testID="last-screen-event">{lastScreenEvent?.name}</Text>
    </View>
  )
}
