import { StyleSheet } from 'react-native'
import { borderRadius, colors, shadows, spacing, typography } from './theme'

/**
 * Common shared styles used across multiple components.
 * Styles are aligned with the web preview panel's Tailwind-based design.
 */
export const commonStyles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },

  // Card/Section styles - matches web panel's rounded-md bg-white shadow
  card: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    ...shadows.sm,
  },

  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },

  // Title styles - matches web panel's text-gray-900 font-semibold
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },

  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },

  subsectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },

  // Text styles
  primaryText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },

  secondaryText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },

  mutedText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    fontStyle: 'italic',
  },

  monoText: {
    fontFamily: 'Courier New',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },

  // List item styles
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.secondary,
    minHeight: 60,
  },

  listItemContent: {
    flex: 1,
    justifyContent: 'center',
  },

  // Button base styles
  buttonBase: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },

  // Footer styles
  footer: {
    padding: spacing.xl,
    backgroundColor: colors.background.secondary,
    borderTopWidth: 1,
    borderTopColor: colors.border.primary,
  },

  // Empty state styles
  emptyText: {
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },

  // Row styles
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  rowSpaceBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Spacing helpers
  marginTopSm: {
    marginTop: spacing.sm,
  },

  marginTopMd: {
    marginTop: spacing.md,
  },

  marginBottomSm: {
    marginBottom: spacing.sm,
  },

  marginBottomMd: {
    marginBottom: spacing.md,
  },

  // Flex helpers
  flex1: {
    flex: 1,
  },

  // JSON viewer styles
  jsonContainer: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },

  jsonText: {
    fontFamily: 'Courier New',
    fontSize: typography.fontSize.xs,
    color: colors.text.primary,
    lineHeight: typography.lineHeight.tight,
  },

  // Shadow helper
  shadow: {
    ...shadows.sm,
  },

  // Card with border - matches web panel's ring-1 ring-gray-300
  cardWithBorder: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.secondary,
  },
})

export default commonStyles
