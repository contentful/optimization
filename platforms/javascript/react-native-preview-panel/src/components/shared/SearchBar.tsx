import React, { useCallback } from 'react'
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native'
import { borderRadius, colors, spacing, typography } from '../../styles/theme'
import type { SearchBarProps } from '../../types'

/**
 * Search input component for filtering audiences and experiences.
 *
 * Features:
 * - Controlled input with clear button
 * - Search icon indicator
 */
export const SearchBar = ({
  value,
  onChangeText,
  placeholder = 'Search audiences and experiences...',
  style,
}: SearchBarProps): React.JSX.Element => {
  const handleClear = useCallback((): void => {
    onChangeText('')
  }, [onChangeText])

  return (
    <View style={[styles.container, style]}>
      {/* Search Icon */}
      <View style={styles.iconContainer}>
        <SearchIcon />
      </View>

      {/* Input */}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="never"
        returnKeyType="search"
        accessibilityLabel="Search"
        accessibilityHint="Search audiences and experiences by name"
      />

      {/* Clear Button */}
      {value.length > 0 && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClear}
          accessibilityLabel="Clear search"
          accessibilityRole="button"
        >
          <ClearIcon />
        </TouchableOpacity>
      )}
    </View>
  )
}

/**
 * Simple search icon component
 */
const SearchIcon = (): React.JSX.Element => (
  <View style={iconStyles.searchIcon}>
    <View style={iconStyles.searchCircle} />
    <View style={iconStyles.searchHandle} />
  </View>
)

/**
 * Simple clear/X icon component
 */
const ClearIcon = (): React.JSX.Element => (
  <View style={iconStyles.clearContainer}>
    <View style={[iconStyles.clearLine, iconStyles.clearLine1]} />
    <View style={[iconStyles.clearLine, iconStyles.clearLine2]} />
  </View>
)

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.secondary,
    paddingHorizontal: spacing.md,
    height: 40, // Matches web panel py-1.5 (~40px)
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    paddingVertical: spacing.xs,
  },
  clearButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
})

const iconStyles = StyleSheet.create({
  searchIcon: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.text.muted,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  searchHandle: {
    width: 6,
    height: 2,
    backgroundColor: colors.text.muted,
    position: 'absolute',
    bottom: 2,
    right: 0,
    transform: [{ rotate: '45deg' }],
  },
  clearContainer: {
    width: 16,
    height: 16,
    backgroundColor: colors.text.muted,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearLine: {
    position: 'absolute',
    width: 8,
    height: 2,
    backgroundColor: colors.background.secondary,
    borderRadius: 1,
  },
  clearLine1: {
    transform: [{ rotate: '45deg' }],
  },
  clearLine2: {
    transform: [{ rotate: '-45deg' }],
  },
})

export default SearchBar
