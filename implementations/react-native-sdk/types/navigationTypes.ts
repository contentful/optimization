import type { ParamListBase } from '@react-navigation/native'

export interface NavigationTestStackParamList extends ParamListBase {
  NavigationHome: undefined
  NavigationViewOne: undefined
  NavigationViewTwo: undefined
}

export interface ScreenViewEvent {
  type: string
  name: string
  properties?: Record<string, unknown>
  context?: Record<string, unknown>
}

export interface NavigationTestScreenProps {
  onClose: () => void
}
