import {
  inject,
  mergeApplicationConfig,
  provideAppInitializer,
  REQUEST,
  RESPONSE_INIT,
  TransferState,
  type ApplicationConfig,
} from '@angular/core'
import { provideServerRendering, withRoutes } from '@angular/ssr'
import { PAGES } from 'e2e-web'
import { appConfig } from './app.config'
import { serverRoutes } from './app.routes.server'
import { NG_CONTENTFUL_OPTIMIZATION_CONFIG } from './config'
import { NgContentfulClient } from './services/contentful-client'
import {
  createServerOptimization,
  getServerOptimizationData,
  persistAnonymousIdCookie,
  resolveServerEntries,
  stampServerHandoff,
} from './services/optimization-server'

async function runServerPreflight(): Promise<void> {
  const request = inject(REQUEST, { optional: true })
  if (!request) return

  const responseInit = inject(RESPONSE_INIT, { optional: true })
  const transferState = inject(TransferState)
  const config = inject(NG_CONTENTFUL_OPTIMIZATION_CONFIG)
  const contentful = inject(NgContentfulClient)

  const sdk = await createServerOptimization(config)
  const baselineIds = [...new Set([...PAGES.home.ids, ...PAGES.pageTwo.ids])]
  const baselines = await contentful.fetchEntries(baselineIds)

  const serverData = await getServerOptimizationData(sdk, request, config.locale)

  if (serverData.consentGranted && serverData.canPersistProfile && responseInit) {
    persistAnonymousIdCookie(responseInit, serverData.profileId)
  }

  const resolvedEntries = resolveServerEntries(
    sdk,
    baselines,
    serverData.consentGranted ? serverData.data.selectedOptimizations : [],
  )
  stampServerHandoff(transferState, serverData, resolvedEntries)
}

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    provideAppInitializer(runServerPreflight),
  ],
}

export const config = mergeApplicationConfig(appConfig, serverConfig)
