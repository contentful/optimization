import { Component, inject } from '@angular/core'
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router'
import { TrackingLog } from './components/tracking-log'
import { NgLiveUpdates } from './services/live-updates'
import { NgContentfulOptimization } from './services/optimization'

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TrackingLog],
  templateUrl: './app.html',
})
export class App {
  private readonly liveUpdatesService = inject(NgLiveUpdates)

  protected readonly previewPanelOpen = this.liveUpdatesService.previewPanelVisible

  constructor() {
    // forces singleton creation on startup to wire up page tracking before first route
    inject(NgContentfulOptimization)
  }
}
