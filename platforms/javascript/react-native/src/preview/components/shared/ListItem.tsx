import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { commonStyles } from '../../styles/common'
import { opacity, spacing } from '../../styles/theme'
import type { ListItemProps } from '../../types'
import { ActionButton } from './ActionButton'
import { Badge } from './Badge'

export function ListItem({
  label,
  value,
  subtitle,
  action,
  badge,
  onLongPress,
}: ListItemProps): React.JSX.Element {
  const ContentWrapper = onLongPress ? TouchableOpacity : View

  return (
    <View style={commonStyles.listItem}>
      <ContentWrapper
        style={commonStyles.listItemContent}
        onLongPress={onLongPress}
        activeOpacity={onLongPress ? opacity.active : opacity.full}
      >
        <View style={styles.labelRow}>
          <Text style={commonStyles.primaryText}>{label}</Text>
          {badge && (
            <View style={styles.badgeContainer}>
              <Badge label={badge.label} variant={badge.variant} />
            </View>
          )}
        </View>
        {value && <Text style={commonStyles.secondaryText}>{value}</Text>}
        {subtitle && <Text style={commonStyles.monoText}>{subtitle}</Text>}
      </ContentWrapper>

      {action && (
        <View style={styles.actionContainer}>
          <ActionButton label={action.label} variant={action.variant} onPress={action.onPress} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  badgeContainer: {},
  actionContainer: {
    marginLeft: spacing.md,
  },
})

export default ListItem
