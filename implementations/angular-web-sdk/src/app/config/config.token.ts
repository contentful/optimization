import { InjectionToken } from '@angular/core'

export interface Config {
  clientId: string
  sdkEnvironment: string
  insightsBaseUrl: string
  experienceBaseUrl: string
  logLevel: 'debug' | 'warn' | 'error'
  contentfulSpaceId: string
  contentfulToken: string
  contentfulEnvironment: string
  contentfulCdaHost: string
  contentfulBasePath: string
  enablePreviewPanel: boolean
}

export const CONFIG = new InjectionToken<Config>('CONFIG', {
  providedIn: 'root',
  factory: () => ({
    clientId: 'mock-client-id',
    sdkEnvironment: 'main',
    insightsBaseUrl: 'http://localhost:8000/insights/',
    experienceBaseUrl: 'http://localhost:8000/experience/',
    logLevel: 'debug',
    contentfulSpaceId: 'mock-space-id',
    contentfulToken: 'mock-token',
    contentfulEnvironment: 'master',
    contentfulCdaHost: 'localhost:8000',
    contentfulBasePath: 'contentful',
    enablePreviewPanel: import.meta.env.PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL !== 'false',
  }),
})
