import { Component, inject } from '@angular/core'
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router'
import { Tracking } from './components/tracking'
import { NgContentfulOptimization } from './services/optimization'

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Tracking],
  templateUrl: './app.html',
})
export class App {
  constructor() {
    // forces singleton creation on startup to wire up page tracking before first route
    inject(NgContentfulOptimization)
  }
}
