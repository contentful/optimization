import React from 'react'
import { Button, Text, View } from 'react-native'

interface ImplementationNavigationViewProps {
  testIdSuffix: string
  lastScreenEventName?: string
  screenEventLog: string[]
  onNavigateNext?: () => void
  nextButtonTitle?: string
  nextButtonTestId?: string
}

export function ImplementationNavigationView({
  testIdSuffix,
  lastScreenEventName,
  screenEventLog,
  onNavigateNext,
  nextButtonTitle,
  nextButtonTestId,
}: ImplementationNavigationViewProps): React.JSX.Element {
  return (
    <View
      testID={`navigation-view-test-${testIdSuffix}`}
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
    >
      <Text testID="last-screen-event">{lastScreenEventName}</Text>
      <Text testID="screen-event-log">{screenEventLog.join(',')}</Text>
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
