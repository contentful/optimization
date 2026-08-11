import { inject } from '@angular/core'
import type { CanActivateFn, Routes } from '@angular/router'
import { Home } from './pages/home'
import { PageTwo } from './pages/page-two'
import { NgContentfulOptimization } from './services/optimization'

const pageSelectionsReady: CanActivateFn = async (_, state) => {
  await inject(NgContentfulOptimization).prepareRoute(state.url)
  return true
}

export const routes: Routes = [
  {
    path: '',
    component: Home,
    canActivate: [pageSelectionsReady],
    runGuardsAndResolvers: 'always',
  },
  {
    path: 'page-two',
    component: PageTwo,
    canActivate: [pageSelectionsReady],
    runGuardsAndResolvers: 'always',
  },
  { path: '**', redirectTo: '' },
]
