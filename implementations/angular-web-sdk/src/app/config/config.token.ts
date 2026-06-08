import { InjectionToken } from '@angular/core'

export interface Config {
  clientId: string
  sdkEnvironment: string
  insightsBaseUrl: string
  experienceBaseUrl: string
  logLevel: 'debug' | 'warn' | 'error'
}

export const CONFIG = new InjectionToken<Config>('CONFIG', {
  providedIn: 'root',
  factory: () => ({
    clientId: 'mock-client-id',
    sdkEnvironment: 'main',
    insightsBaseUrl: 'http://localhost:8000/insights/',
    experienceBaseUrl: 'http://localhost:8000/experience/',
    logLevel: 'debug',
  }),
})
