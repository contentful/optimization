import { Component, inject } from '@angular/core'
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router'
import { NgContentfulOptimization } from '@contentful/optimization-angular'
import { AnalyticsEventDisplay } from './components/analytics-event-display/analytics-event-display'

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AnalyticsEventDisplay],
  templateUrl: './app.html',
})
export class App {
  constructor() {
    // forces singleton creation on startup to wire up page tracking before first route
    inject(NgContentfulOptimization)
  }
}
