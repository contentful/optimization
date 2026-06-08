import type { Routes } from '@angular/router'
import { Home } from './pages/home/home'
import { PageTwo } from './pages/page-two/page-two'

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'page-two', component: PageTwo },
  { path: '**', redirectTo: '' },
]
