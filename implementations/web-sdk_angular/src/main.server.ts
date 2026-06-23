import { bootstrapApplication, type BootstrapContext } from '@angular/platform-browser'
import { App } from './app/app'
import { config } from './app/app.config.server'

async function bootstrap(context: BootstrapContext): Promise<unknown> {
  return await bootstrapApplication(App, config, context)
}

export default bootstrap
