import { InjectionToken } from '@angular/core'

// Fields added incrementally as each feature needs them.
export type Config = Record<string, never>

export const CONFIG = new InjectionToken<Config>('CONFIG', {
  providedIn: 'root',
  factory: () => ({}),
})
