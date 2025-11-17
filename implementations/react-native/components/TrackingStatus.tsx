import React, { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import type Optimization from '@contentful/optimization-react-native'

interface TrackingStatusProps {
  sdk: Optimization
  componentId: string
  testID?: string
}

export function TrackingStatus({
  sdk,
  componentId,
  testID,
}: TrackingStatusProps): React.JSX.Element {
  const [isTracked, setIsTracked] = useState(false)

  useEffect(() => {
    const originalTrackComponentView = sdk.analytics.trackComponentView.bind(sdk.analytics)

    sdk.analytics.trackComponentView = async (params): Promise<void> => {
      if (params.componentId === componentId) {
        setIsTracked(true)
      }

      await originalTrackComponentView(params)
    }

    return () => {
      sdk.analytics.trackComponentView = originalTrackComponentView
    }
  }, [sdk, componentId])

  return (
    <View testID={testID}>
      <Text testID={testID ? `${testID}-text` : undefined}>
        {isTracked ? 'Tracked Successfully' : 'Not Tracked'}
      </Text>
    </View>
  )
}
