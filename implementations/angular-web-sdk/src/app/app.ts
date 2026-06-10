import { Component, inject } from '@angular/core'
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router'
import { NgContentfulOptimization } from '@contentful/optimization-angular'
import { EventLog } from './components/event-log'

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, EventLog],
  templateUrl: './app.html',
})
export class App {
  constructor() {
    // forces singleton creation on startup to wire up page tracking before first route
    inject(NgContentfulOptimization)
  }
}
