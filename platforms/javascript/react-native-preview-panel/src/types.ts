import type { Profile, SelectedPersonalization } from '@contentful/optimization-core'
import type { StyleProp, ViewStyle } from 'react-native'

// ============================================================================
// Audience & Experience Definitions
// ============================================================================

/**
 * Audience definition from the optimization platform.
 * Contains metadata about an audience segment.
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
 * Generic Contentful entry structure used for enriching definitions.
 * This is a simplified type that captures the essential fields needed
 * for mapping Contentful entries to preview panel definitions.
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
 * Entry collection response from Contentful client.
 * Includes pagination metadata for batched fetching.
 */
export interface ContentfulEntryCollection {
  items: ContentfulEntry[]
  total: number
  skip: number
  limit: number
}

/**
 * Minimal Contentful client interface required by the PreviewPanel.
 * This allows the panel to fetch audience and experience entries directly.
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
 * Experience definition from the optimization platform.
 * Represents a personalization or experiment configuration.
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
 * Three-state override value for audiences.
 * - 'on': Force audience to be active
 * - 'off': Force audience to be inactive
 * - 'default': Let SDK determine based on evaluation
 */
export type AudienceOverrideState = 'on' | 'off' | 'default'

/**
 * Combined audience data with associated experiences.
 * Used for displaying audience-grouped experience lists.
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
 * This data is typically provided by the developer from their CMS.
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
 * Audience override state - tracks manual audience activations/deactivations
 */
export interface AudienceOverride {
  /** Audience ID being overridden */
  audienceId: string
  /** Whether the audience is activated (true) or deactivated (false) */
  isActive: boolean
  /** Source of the override - 'manual' for user-initiated */
  source: 'manual'
}

/**
 * Personalization override state - tracks manual variant selections
 */
export interface PersonalizationOverride {
  /** Experience ID being overridden */
  experienceId: string
  /** The variant index to force (0 = baseline) */
  variantIndex: number
}

/**
 * Combined override state managed by the preview panel
 */
export interface OverrideState {
  /** Map of audience ID to override */
  audiences: Record<string, AudienceOverride>
  /** Map of experience ID to override */
  personalizations: Record<string, PersonalizationOverride>
}

/**
 * Preview state derived from SDK signals
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
 * Actions available in the preview panel
 */
export interface PreviewActions {
  /** Activate an audience override */
  activateAudience: (audienceId: string) => void
  /** Deactivate an audience override */
  deactivateAudience: (audienceId: string) => void
  /** Reset a specific audience override */
  resetAudienceOverride: (audienceId: string) => void
  /** Set a personalization variant override */
  setVariantOverride: (experienceId: string, variantIndex: number) => void
  /** Reset a specific personalization override */
  resetPersonalizationOverride: (experienceId: string) => void
  /** Reset SDK state to actual by clearing all overrides */
  resetSdkState: () => void
}

/**
 * Props for the main PreviewPanel component
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
 * Props for Section component
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
 * Props for ListItem component
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
 * Props for ActionButton component
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
 * Props for Badge component
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
 * Props for JsonViewer component
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
 * Props for ProfileSection component
 */
export interface ProfileSectionProps {
  /** Profile data to display */
  profile: Profile | undefined
  /** Whether profile is loading */
  isLoading: boolean
}

/**
 * Props for PersonalizationsSection component
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
 * Props for OverridesSection component
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
 * Props for AudienceSection component
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
 * Props for AudienceItem component
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
  /** Whether the item is expanded (controlled mode) */
  isExpanded?: boolean
  /** Handler for expansion toggle (controlled mode) */
  onToggleExpand?: () => void
}

/**
 * Props for AudienceToggle component
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
 * Props for ExperienceCard component
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
 * Props for VariantSelector component
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
 * Props for SearchBar component
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
 * Props for QualificationIndicator component
 */
export interface QualificationIndicatorProps {
  /** Tooltip content */
  tooltipContent?: string
  /** Custom style */
  style?: StyleProp<ViewStyle>
}
