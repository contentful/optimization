import React, { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { commonStyles } from '../../styles/common'
import { colors, opacity, spacing, typography } from '../../styles/theme'
import type { SectionProps } from '../../types'

export function Section({
  title,
  collapsible = false,
  initiallyCollapsed = false,
  children,
  style,
}: SectionProps): React.JSX.Element {
  const [isCollapsed, setIsCollapsed] = useState(initiallyCollapsed)

  const toggleCollapse = (): void => {
    if (collapsible) {
      setIsCollapsed((prev) => !prev)
    }
  }

  const HeaderComponent = collapsible ? TouchableOpacity : View

  return (
    <View style={[commonStyles.card, styles.container, style]}>
      <HeaderComponent
        style={styles.header}
        onPress={collapsible ? toggleCollapse : undefined}
        activeOpacity={collapsible ? opacity.active : opacity.full}
      >
        <Text style={commonStyles.sectionTitle}>{title}</Text>
        {collapsible && <Text style={styles.collapseIcon}>{isCollapsed ? '▶' : '▼'}</Text>}
      </HeaderComponent>
      {!isCollapsed && <View style={styles.content}>{children}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  collapseIcon: {
    fontSize: typography.fontSize.lg,
    color: colors.accent.secondary,
    fontWeight: typography.fontWeight.bold,
  },
  content: {
    marginTop: spacing.sm,
  },
})

export default Section
