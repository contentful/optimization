import { useOptimization } from '@contentful/optimization-react-native'
import React, { useEffect, useState } from 'react'
import { Button, Text, View } from 'react-native'
import type { ScreenViewEvent } from '../types/navigationTypes'
import { isScreenViewEvent } from '../utils/navigationHelpers'

interface ImplementationNavigationViewProps {
  testIdSuffix: string
  onNavigateNext?: () => void
  nextButtonTitle?: string
  nextButtonTestId?: string
}

export function ImplementationNavigationView({
  testIdSuffix,
  onNavigateNext,
  nextButtonTitle,
  nextButtonTestId,
}: ImplementationNavigationViewProps): React.JSX.Element {
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
      testID={`navigation-view-test-${testIdSuffix}`}
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
    >
      <Text testID="last-screen-event">{lastScreenEvent?.name}</Text>
      {onNavigateNext ? (
        <Button
          testID={nextButtonTestId ?? 'go-to-view-two-button'}
          title={nextButtonTitle ?? 'Go to View Two'}
          onPress={onNavigateNext}
        />
      ) : null}
    </View>
  )
}
