import type { Profile, SelectedPersonalization } from '@contentful/optimization-core/api-schemas'
import type { StyleProp, ViewStyle } from 'react-native'

// ============================================================================
// Audience & Experience Definitions
// ============================================================================

/**
 * Audience definition from the optimization platform.
 *
 * @public
 */
export interface AudienceDefinition {
  /** Unique audience identifier */
  id: string
  /** Human-readable audience name */
  name: string
  /** Optional description of audience targeting criteria */
  description?: string
}

/**
 * Variant distribution configuration for an experience.
 *
 * @public
 */
export interface VariantDistribution {
  /** Variant index (0 = baseline) */
  index: number
  /** Reference to the variant content */
  variantRef: string
  /** Optional traffic percentage (0-100) */
  percentage?: number
  /** Optional human-readable name from Contentful entry */
  name?: string
}

// ============================================================================
// Contentful Entry Types (for enrichment)
// ============================================================================

/**
 * Simplified Contentful entry structure for mapping entries to preview panel definitions.
 *
 * @public
 */
export interface ContentfulEntry {
  sys: {
    id: string
    contentType?: {
      sys: {
        id: string
      }
    }
  }
  fields: Record<string, unknown>
}

/**
 * Entry collection response from the Contentful client, including pagination metadata.
 *
 * @public
 */
export interface ContentfulEntryCollection {
  items: ContentfulEntry[]
  total: number
  skip: number
  limit: number
}

/**
 * Minimal Contentful client interface required by the preview panel.
 *
 * @public
 */
export interface ContentfulClient {
  getEntries: (query: {
    content_type: string
    include?: number
    skip?: number
    limit?: number
  }) => Promise<ContentfulEntryCollection>
}

/**
 * Experience definition representing a personalization or experiment configuration.
 *
 * @public
 */
export interface ExperienceDefinition {
  /** Unique experience identifier */
  id: string
  /** Human-readable experience name */
  name: string
  /** Type of experience */
  type: 'nt_personalization' | 'nt_experiment'
  /** Variant distribution configuration */
  distribution: VariantDistribution[]
  /** Associated audience (if audience-targeted) */
  audience?: { id: string }
}

/**
 * Three-state override value for audiences: `'on'` forces active, `'off'` forces
 * inactive, `'default'` defers to the SDK evaluation.
 *
 * @public
 */
export type AudienceOverrideState = 'on' | 'off' | 'default'

/**
 * Combined audience data with associated experiences, used for audience-grouped display.
 *
 * @public
 */
export interface AudienceWithExperiences {
  /** Audience definition */
  audience: AudienceDefinition
  /** Experiences targeting this audience */
  experiences: ExperienceDefinition[]
  /** Whether user naturally qualifies for this audience (from API) */
  isQualified: boolean
  /** Whether audience is currently active (considering overrides) */
  isActive: boolean
  /** Current override state */
  overrideState: AudienceOverrideState
}

/**
 * Preview data containing all audience and experience definitions.
 *
 * @public
 */
export interface PreviewData {
  /** All available audience definitions */
  audienceDefinitions: AudienceDefinition[]
  /** All available experience definitions */
  experienceDefinitions: ExperienceDefinition[]
}

// ============================================================================
// Override State Types
// ============================================================================

/**
 * Tracks a manual audience activation or deactivation override.
 *
 * @public
 */
export interface AudienceOverride {
  /** Audience ID being overridden */
  audienceId: string
  /** Whether the audience is activated (true) or deactivated (false) */
  isActive: boolean
  /** Source of the override - 'manual' for user-initiated */
  source: 'manual'
  /** Experience IDs that were set with this audience override */
  experienceIds: string[]
}

/**
 * Tracks a manual variant selection override.
 *
 * @public
 */
export interface PersonalizationOverride {
  /** Experience ID being overridden */
  experienceId: string
  /** The variant index to force (0 = baseline) */
  variantIndex: number
}

/**
 * Combined override state managed by the preview panel.
 *
 * @public
 */
export interface OverrideState {
  /** Map of audience ID to override */
  audiences: Record<string, AudienceOverride>
  /** Map of experience ID to override */
  personalizations: Record<string, PersonalizationOverride>
}

/**
 * Preview state derived from SDK signals.
 *
 * @public
 */
export interface PreviewState {
  /** Current profile from SDK */
  profile: Profile | undefined
  /** Current personalizations from SDK */
  personalizations: SelectedPersonalization[] | undefined
  /** Current consent state */
  consent: boolean | undefined
  /** Whether SDK data is loading */
  isLoading: boolean
}

/**
 * Actions available in the preview panel for overriding audiences and personalizations.
 *
 * @public
 */
export interface PreviewActions {
  /** Activate an audience override and set variant index to 1 for associated experiences */
  activateAudience: (audienceId: string, experiences: ExperienceDefinition[]) => void
  /** Deactivate an audience override and set variant index to 0 for associated experiences */
  deactivateAudience: (audienceId: string, experiences: ExperienceDefinition[]) => void
  /** Reset a specific audience override and its associated experience overrides */
  resetAudienceOverride: (audienceId: string) => void
  /** Set a personalization variant override */
  setVariantOverride: (experienceId: string, variantIndex: number) => void
  /** Reset a specific personalization override */
  resetPersonalizationOverride: (experienceId: string) => void
  /** Reset SDK state to actual by clearing all overrides */
  resetSdkState: () => void
}

/**
 * Props for the {@link PreviewPanel} component.
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
   * The panel will automatically fetch nt_audience and nt_experience content types.
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
 * @public
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
 * @public
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
 * @public
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
}

/**
 * Props for the {@link Badge} component.
 *
 * @public
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
 * @public
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
 * @public
 */
export interface ProfileSectionProps {
  /** Profile data to display */
  profile: Profile | undefined
  /** Whether profile is loading */
  isLoading: boolean
}

/**
 * Props for the {@link PersonalizationsSection} component.
 *
 * @public
 */
export interface PersonalizationsSectionProps {
  /** Active personalizations */
  personalizations: SelectedPersonalization[] | undefined
  /** Current overrides */
  overrides: Record<string, PersonalizationOverride>
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
 * @public
 */
export interface OverridesSectionProps {
  /** Current override state */
  overrides: OverrideState
  /** Reset specific audience override */
  onResetAudience: (audienceId: string) => void
  /** Reset specific personalization override */
  onResetPersonalization: (experienceId: string) => void
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
 * @public
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
  experienceOverrides: Record<string, PersonalizationOverride>
  /** Map of experienceId to variantIndex from SDK personalizations */
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
 * @public
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
  experienceOverrides: Record<string, PersonalizationOverride>
  /** Map of experienceId to variantIndex from SDK personalizations */
  sdkVariantIndices: Record<string, number>
  /** Whether the item is expanded (controlled mode) */
  isExpanded?: boolean
  /** Handler for expansion toggle (controlled mode) */
  onToggleExpand?: () => void
}

/**
 * Props for the {@link AudienceToggle} component.
 *
 * @public
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
 * @public
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
 * @public
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
 * Props for the {@link SearchBar} component.
 *
 * @public
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
 * @public
 */
export interface QualificationIndicatorProps {
  /** Tooltip content */
  tooltipContent?: string
  /** Custom style */
  style?: StyleProp<ViewStyle>
}
