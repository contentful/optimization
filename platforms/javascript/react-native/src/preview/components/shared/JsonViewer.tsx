import React, { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { commonStyles } from '../../styles/common'
import { colors, spacing, typography } from '../../styles/theme'
import type { JsonViewerProps } from '../../types'

const PREVIEW_LINES = 3

export function JsonViewer({
  data,
  initiallyExpanded = false,
  title = 'JSON Data',
}: JsonViewerProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded)

  const jsonString = JSON.stringify(data, null, 2)
  const jsonLines = jsonString.split('\n')
  const previewText = jsonLines.slice(0, PREVIEW_LINES).join('\n') + '\n  ...'

  const toggleExpanded = (): void => {
    setIsExpanded((prev) => !prev)
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.header} onPress={toggleExpanded}>
        <Text style={commonStyles.subsectionTitle}>{title}</Text>
        <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
      </TouchableOpacity>

      <View style={commonStyles.jsonContainer}>
        <Text style={commonStyles.jsonText}>{isExpanded ? jsonString : previewText}</Text>
      </View>

      {isExpanded && (
        <TouchableOpacity style={styles.collapseButton} onPress={toggleExpanded}>
          <Text style={styles.collapseButtonText}>Close</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  expandIcon: {
    fontSize: typography.fontSize.lg,
    color: colors.accent.secondary,
    fontWeight: typography.fontWeight.bold,
  },
  collapseButton: {
    backgroundColor: colors.background.tertiary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 4,
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  collapseButtonText: {
    fontSize: typography.fontSize.md,
    color: colors.accent.secondary,
    fontWeight: typography.fontWeight.semibold,
  },
})

export default JsonViewer
