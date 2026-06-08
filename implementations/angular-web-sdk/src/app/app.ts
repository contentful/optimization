import { Component, inject } from '@angular/core'
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router'
import { Optimization } from './optimization/optimization'

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
})
export class App {
  // Injecting here forces the singleton to be created on app startup,
  // which wires up page tracking before any route is rendered.
  protected readonly optimization = inject(Optimization)
}
