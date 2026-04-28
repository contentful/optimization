import type { Profile, SelectedOptimization } from '@contentful/optimization-core/api-schemas'
import type {
  AudienceOverrideState,
  AudienceWithExperiences,
  ContentfulClient,
  ExperienceDefinition,
  OptimizationOverride,
  OverrideState,
  PreviewSdkSignals,
} from '@contentful/optimization-core/preview-support'
import type { StyleProp, ViewStyle } from 'react-native'

// ============================================================================
// Re-exports from core
// ============================================================================

export type {
  AudienceDefinition,
  AudienceOverride,
  AudienceOverrideState,
  AudienceWithExperiences,
  ContentfulClient,
  ContentfulEntry,
  ContentfulEntryCollection,
  ExperienceDefinition,
  OptimizationOverride,
  OverrideState,
  PreviewData,
  VariantDistribution,
} from '@contentful/optimization-core/preview-support'

/**
 * Preview state derived from SDK signals.
 *
 * @internal
 */
export type PreviewState = PreviewSdkSignals

/**
 * Actions available in the preview panel for overriding audiences and optimizations.
 *
 * @internal
 */
export interface PreviewActions {
  /** Activate an audience override and set variant index to 1 for associated experiences */
  activateAudience: (audienceId: string, experiences: ExperienceDefinition[]) => void
  /** Deactivate an audience override and set variant index to 0 for associated experiences */
  deactivateAudience: (audienceId: string, experiences: ExperienceDefinition[]) => void
  /** Reset a specific audience override and its associated experience overrides */
  resetAudienceOverride: (audienceId: string) => void
  /** Set an optimization variant override */
  setVariantOverride: (experienceId: string, variantIndex: number) => void
  /** Reset a specific optimization override */
  resetOptimizationOverride: (experienceId: string) => void
  /** Reset SDK state to actual by clearing all overrides */
  resetSdkState: () => void
}

/**
 * Props for the `PreviewPanel` component.
 *
 * @public
 */
export interface PreviewPanelProps {
  /** Whether to show the header with title */
  showHeader?: boolean
  /** Custom container style */
  style?: StyleProp<ViewStyle>
  /** Called when the panel visibility changes */
  onVisibilityChange?: (isVisible: boolean) => void
  /**
   * Contentful client instance used to fetch audience and experience entries.
   * The panel will automatically fetch `nt_audience` and `nt_experience` content types
   * (Contentful content type IDs created by the Optimization platform).
   */
  contentfulClient: ContentfulClient
}

/**
 * Props for the {@link PreviewPanelOverlay} component.
 *
 * @public
 */
export interface PreviewPanelOverlayProps extends Omit<PreviewPanelProps, 'style'> {
  /** App content that the overlay wraps */
  children: React.ReactNode
  /** Optional positioning overrides for the floating action button */
  fabPosition?: { bottom?: number; right?: number }
}

/**
 * Props for the {@link Section} component.
 *
 * @internal
 */
export interface SectionProps {
  /** Section title */
  title: string
  /** Whether section is collapsible */
  collapsible?: boolean
  /** Initial collapsed state */
  initiallyCollapsed?: boolean
  /** Section content */
  children: React.ReactNode
  /** Custom container style */
  style?: StyleProp<ViewStyle>
}

/**
 * Props for the {@link ListItem} component.
 *
 * @internal
 */
export interface ListItemProps {
  /** Primary label text */
  label: string
  /** Secondary value text */
  value?: string
  /** Optional subtitle text */
  subtitle?: string
  /** Action button configuration */
  action?: {
    label: string
    variant: 'activate' | 'deactivate' | 'reset'
    onPress: () => void
    testID?: string
  }
  /** Badge to display */
  badge?: {
    label: string
    variant: 'api' | 'override' | 'manual'
  }
  /** Called on long press (for copying) */
  onLongPress?: () => void
}

/**
 * Props for the {@link ActionButton} component.
 *
 * @internal
 */
export interface ActionButtonProps {
  /** Button label */
  label: string
  /** Button variant determines styling */
  variant: 'activate' | 'deactivate' | 'reset' | 'primary' | 'secondary' | 'destructive'
  /** Press handler */
  onPress: () => void
  /** Whether button is disabled */
  disabled?: boolean
  /** Custom style */
  style?: StyleProp<ViewStyle>
  /** Test ID for automated UI testing */
  testID?: string
}

/**
 * Props for the {@link Badge} component.
 *
 * @internal
 */
export interface BadgeProps {
  /** Badge label */
  label: string
  /** Badge variant determines styling */
  variant:
    | 'api'
    | 'override'
    | 'manual'
    | 'info'
    | 'experiment'
    | 'personalization'
    | 'qualified'
    | 'primary'
}

/**
 * Props for the {@link JsonViewer} component.
 *
 * @internal
 */
export interface JsonViewerProps {
  /** Data to display as JSON */
  data: unknown
  /** Whether initially expanded */
  initiallyExpanded?: boolean
  /** Title for the viewer */
  title?: string
}

/**
 * Props for the {@link ProfileSection} component.
 *
 * @internal
 */
export interface ProfileSectionProps {
  /** Profile data to display */
  profile: Profile | undefined
  /** Whether profile is loading */
  isLoading: boolean
}

/**
 * Props for the {@link OptimizationsSection} component.
 *
 * @internal
 */
export interface OptimizationsSectionProps {
  /** Active selected optimizations */
  selectedOptimizations: SelectedOptimization[] | undefined
  /** Current overrides */
  overrides: Record<string, OptimizationOverride>
  /** Set variant override handler */
  onSetVariant: (experienceId: string, variantIndex: number) => void
  /** Reset override handler */
  onResetOverride: (experienceId: string) => void
  /** Optional map of experienceId to human-readable name from Contentful entries */
  experienceNames?: Record<string, string>
}

/**
 * Props for the {@link OverridesSection} component.
 *
 * @internal
 */
export interface OverridesSectionProps {
  /** Current override state */
  overrides: OverrideState
  /** Reset specific audience override */
  onResetAudience: (audienceId: string) => void
  /** Reset specific optimization override */
  onResetOptimization: (experienceId: string) => void
  /** Optional map of audienceId to human-readable name */
  audienceNames?: Record<string, string>
  /** Optional map of experienceId to human-readable name */
  experienceNames?: Record<string, string>
}

// ============================================================================
// New Component Props (Feature Parity)
// ============================================================================

/**
 * Props for the {@link AudienceSection} component.
 *
 * @internal
 */
export interface AudienceSectionProps {
  /** List of audiences with their experiences */
  audiencesWithExperiences: AudienceWithExperiences[]
  /** Handler for audience toggle changes */
  onAudienceToggle: (audienceId: string, state: AudienceOverrideState) => void
  /** Handler for variant selection */
  onSetVariant: (experienceId: string, variantIndex: number) => void
  /** Handler for resetting an experience override */
  onResetExperience: (experienceId: string) => void
  /** Current experience variant overrides */
  experienceOverrides: Record<string, OptimizationOverride>
  /** Map of experienceId to variantIndex from SDK selected optimizations */
  sdkVariantIndices: Record<string, number>
  /** Search query for filtering */
  searchQuery?: string
  /** Check if a specific audience is expanded */
  isAudienceExpanded?: (audienceId: string) => boolean
  /** Toggle a specific audience's expanded state */
  onToggleAudienceExpand?: (audienceId: string) => void
  /** Toggle all audiences expanded/collapsed */
  onToggleAllExpand?: () => void
  /** Whether all audiences are currently expanded */
  allExpanded?: boolean
  /** Initialize a collapsible for an audience */
  initializeCollapsible?: (audienceId: string) => void
}

/**
 * Props for the {@link AudienceItem} component.
 *
 * @internal
 */
export interface AudienceItemProps {
  /** Audience with experiences data */
  audienceWithExperiences: AudienceWithExperiences
  /** Handler for toggle state changes */
  onToggle: (state: AudienceOverrideState) => void
  /** Handler for variant selection */
  onSetVariant: (experienceId: string, variantIndex: number) => void
  /** Handler for resetting an experience override */
  onResetExperience: (experienceId: string) => void
  /** Current experience variant overrides */
  experienceOverrides: Record<string, OptimizationOverride>
  /** Map of experienceId to variantIndex from SDK selected optimizations */
  sdkVariantIndices: Record<string, number>
  /** Whether the item is expanded (controlled mode) */
  isExpanded?: boolean
  /** Handler for expansion toggle (controlled mode) */
  onToggleExpand?: () => void
}

/**
 * Props for the {@link AudienceToggle} component.
 *
 * @internal
 */
export interface AudienceToggleProps {
  /** Current toggle state */
  value: AudienceOverrideState
  /** Handler for state changes */
  onValueChange: (state: AudienceOverrideState) => void
  /** Whether the toggle is disabled */
  disabled?: boolean
  /** Audience ID for accessibility */
  audienceId: string
}

/**
 * Props for the {@link ExperienceCard} component.
 *
 * @internal
 */
export interface ExperienceCardProps {
  /** Experience definition */
  experience: ExperienceDefinition
  /** Whether the parent audience is active */
  isAudienceActive: boolean
  /** Current variant index (from API or override) */
  currentVariantIndex: number
  /** Default variant index from API evaluation */
  defaultVariantIndex?: number
  /** Handler for variant selection */
  onSetVariant: (variantIndex: number) => void
  /** Handler for resetting the override */
  onReset?: () => void
  /** Whether this experience has an override */
  hasOverride: boolean
}

/**
 * Props for the {@link VariantSelector} component.
 *
 * @internal
 */
export interface VariantSelectorProps {
  /** Experience definition with distribution */
  experience: ExperienceDefinition
  /** Currently selected variant index */
  selectedIndex: number
  /** Handler for variant selection */
  onSelect: (variantIndex: number) => void
  /** Whether the parent audience is active */
  isAudienceActive: boolean
  /** Variant index that user naturally qualifies for */
  qualifiedIndex?: number
}

/**
 * Configuration options for the preview panel feature.
 *
 * @public
 */
export interface PreviewPanelConfig {
  /**
   * Whether the preview panel is enabled.
   * When `true`, a floating action button appears that opens the preview panel.
   */
  enabled: boolean

  /**
   * Contentful client instance used to fetch `nt_audience` and `nt_experience` entries
   * (Contentful content type IDs created by the Optimization platform).
   */
  contentfulClient: ContentfulClient

  /**
   * Optional positioning overrides for the floating action button.
   */
  fabPosition?: { bottom?: number; right?: number }

  /**
   * Called when the panel visibility changes.
   */
  onVisibilityChange?: (isVisible: boolean) => void

  /**
   * Whether to show the header with title in the preview panel.
   */
  showHeader?: boolean
}

/**
 * Props for the {@link SearchBar} component.
 *
 * @internal
 */
export interface SearchBarProps {
  /** Current search value */
  value: string
  /** Handler for search value changes */
  onChangeText: (text: string) => void
  /** Placeholder text */
  placeholder?: string
  /** Custom style */
  style?: StyleProp<ViewStyle>
}

/**
 * Props for the {@link QualificationIndicator} component.
 *
 * @internal
 */
export interface QualificationIndicatorProps {
  /** Tooltip content */
  tooltipContent?: string
  /** Custom style */
  style?: StyleProp<ViewStyle>
}
