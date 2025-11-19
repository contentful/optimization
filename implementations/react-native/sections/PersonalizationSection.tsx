import React, { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import type Optimization from '@contentful/optimization-react-native'
import { Personalization, ScrollProvider } from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'

interface PersonalizationSectionProps {
  sdk: Optimization
  personalizationEntry: Entry
}

export function PersonalizationSection({
  sdk,
  personalizationEntry,
}: PersonalizationSectionProps): React.JSX.Element {
  const [componentEvents, setComponentEvents] = useState<
    Array<{ componentId: string; type: string }>
  >([])

  useEffect(() => {
    void sdk.personalization.page({ properties: { url: 'personalization' } })
  }, [sdk])

  useEffect(() => {
    const handleComponentEvent = (event: unknown): void => {
      if (
        event &&
        typeof event === 'object' &&
        'type' in event &&
        event.type === 'component' &&
        'componentId' in event &&
        typeof event.componentId === 'string'
      ) {
        const { componentId } = event
        if (componentId === personalizationEntry.sys.id) {
          setComponentEvents((prev) => {
            if (prev.some((e) => e.componentId === componentId)) {
              return prev
            }
            return [...prev, { componentId, type: 'component' }]
          })
        }
      }
    }

    const subscription = sdk.states.eventStream.subscribe(handleComponentEvent)

    return () => {
      subscription.unsubscribe()
    }
  }, [sdk, personalizationEntry.sys.id])

  return (
    <View testID="personalization-section">
      <ScrollProvider>
        <Personalization baselineEntry={personalizationEntry}>
          {(resolvedEntry) => {
            const text =
              typeof resolvedEntry.fields.text === 'string' ? resolvedEntry.fields.text : ''

            return (
              <View testID="personalization-content">
                <Text testID="personalization-content-text">{text}</Text>
                {componentEvents.map((event) => (
                  <View testID={`personalization-event-component-${event.componentId}`}>
                    <Text key={`personalization-event-${event.componentId}`}>{event.type}</Text>
                  </View>
                ))}
              </View>
            )
          }}
        </Personalization>
      </ScrollProvider>
    </View>
  )
}
