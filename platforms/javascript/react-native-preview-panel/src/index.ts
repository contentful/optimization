// Main component
export { PreviewPanel } from './components/PreviewPanel'

// Feature components (for advanced customization)
export { AudienceItem } from './components/AudienceItem'
export { AudienceSection } from './components/AudienceSection'
export { ExperienceCard } from './components/ExperienceCard'
export { OverridesSection } from './components/OverridesSection'
export { PersonalizationsSection } from './components/PersonalizationsSection'
export { ProfileSection } from './components/ProfileSection'
export { VariantSelector } from './components/VariantSelector'

// Shared UI primitives
export {
  ActionButton,
  AudienceToggle,
  Badge,
  CollapseToggleButton,
  JsonViewer,
  ListItem,
  QualificationIndicator,
  SearchBar,
  Section,
} from './components/shared'

// Hooks
export {
  useCollapsibleControl,
  usePreviewData,
  usePreviewState,
  useProfileOverrides,
} from './hooks'

// Constants
export {
  ALL_VISITORS_AUDIENCE_DESCRIPTION,
  ALL_VISITORS_AUDIENCE_ID,
  ALL_VISITORS_AUDIENCE_NAME,
} from './constants'

// Types
export type {
  ActionButtonProps,
  AudienceDefinition,
  AudienceItemProps,
  AudienceOverride,
  AudienceOverrideState,
  AudienceSectionProps,
  AudienceToggleProps,
  AudienceWithExperiences,
  BadgeProps,
  ContentfulEntry,
  ExperienceCardProps,
  ExperienceDefinition,
  JsonViewerProps,
  ListItemProps,
  OverrideState,
  OverridesSectionProps,
  PersonalizationOverride,
  PersonalizationsSectionProps,
  PreviewActions,
  PreviewData,
  PreviewPanelProps,
  PreviewState,
  ProfileSectionProps,
  QualificationIndicatorProps,
  SearchBarProps,
  SectionProps,
  VariantDistribution,
  VariantSelectorProps,
} from './types'

// Utilities for creating definitions from Contentful entries
export {
  createAudienceDefinitions,
  createExperienceDefinitions,
  createExperienceNameMap,
} from './utils'

// Theme and styles (for custom theming)
export { commonStyles } from './styles/common'
export { borderRadius, colors, shadows, spacing, theme, typography } from './styles/theme'

// Default export for convenience
export { PreviewPanel as default } from './components/PreviewPanel'
