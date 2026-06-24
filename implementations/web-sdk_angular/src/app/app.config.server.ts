import { mergeApplicationConfig, type ApplicationConfig } from '@angular/core'
import { provideServerRendering, withRoutes } from '@angular/ssr'
import { appConfig } from './app.config'
import { serverRoutes } from './app.routes.server'
import { provideServerOptimizationInitializer } from './services/optimization'

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    provideServerOptimizationInitializer(),
  ],
}

export const config = mergeApplicationConfig(appConfig, serverConfig)
