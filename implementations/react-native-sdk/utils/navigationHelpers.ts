import type { NavigationState } from '@react-navigation/native'
import type { ScreenViewEvent } from '../types/navigationTypes'

export function isScreenViewEvent(event: unknown): event is ScreenViewEvent {
  return (
    event !== null &&
    typeof event === 'object' &&
    'type' in event &&
    event.type === 'screen' &&
    'name' in event &&
    typeof event.name === 'string'
  )
}

export function toRecord(params: object | undefined): Record<string, unknown> | undefined {
  if (!params) return undefined
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) {
    result[key] = value
  }
  return result
}

export function adaptNavigationState(state: NavigationState | undefined):
  | {
      index: number
      routes: Array<{ name: string; key: string; params?: Record<string, unknown> }>
    }
  | undefined {
  if (!state) return undefined
  return {
    index: state.index,
    routes: state.routes.map((route) => ({
      name: route.name,
      key: route.key,
      params: toRecord(route.params),
    })),
  }
}
