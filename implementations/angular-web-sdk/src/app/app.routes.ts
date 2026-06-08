import type { Routes } from '@angular/router'
import { HomeComponent } from './pages/home/home'
import { PageTwoComponent } from './pages/page-two/page-two'

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'page-two', component: PageTwoComponent },
  { path: '**', redirectTo: '' },
]
