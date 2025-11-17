export interface SDKInfo {
  clientId: string
  environment: string
  initialized: boolean
  timestamp: string
}

export interface ThemeColors {
  backgroundColor: string
  cardBackground: string
  textColor: string
  mutedTextColor: string
  successColor: string
  errorColor: string
  accentColor: string
}

export interface SDKStatusCardProps {
  sdkLoaded: boolean
  sdkError: string | null
  colors: ThemeColors
}

export interface SDKConfigCardProps {
  sdkInfo: SDKInfo
  colors: ThemeColors
}

export interface InstructionsCardProps {
  colors: ThemeColors
  onTestTracking: () => void
  onTestMergeTags: () => void
}

export interface LoadingScreenProps {
  colors: ThemeColors
  isDarkMode: boolean
}

export interface MainScreenProps {
  colors: ThemeColors
  isDarkMode: boolean
  sdkLoaded: boolean
  sdkError: string | null
  sdkInfo: SDKInfo | null
  onTestTracking: () => void
  onTestMergeTags: () => void
}
