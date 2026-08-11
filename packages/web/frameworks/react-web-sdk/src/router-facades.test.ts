import * as genericRuntime from './index'
import * as nextAppFacade from './next-app'
import * as nextPagesFacade from './next-pages'
import * as reactRouterFacade from './react-router-facade'
import { NextAppAutoPageTracker } from './router/next-app'
import { NextPagesAutoPageTracker } from './router/next-pages'
import { ReactRouterAutoPageTracker } from './router/react-router'
import { TanStackRouterAutoPageTracker } from './router/tanstack-router'
import * as tanStackRouterFacade from './tanstack-router'

function autoPageTrackerExports(moduleExports: object): string[] {
  return Object.keys(moduleExports).filter((exportName) => exportName.endsWith('AutoPageTracker'))
}

function expectGenericRuntimeIdentity(moduleExports: Readonly<Record<string, unknown>>): void {
  for (const [exportName, genericExport] of Object.entries(genericRuntime)) {
    expect(moduleExports[exportName]).toBe(genericExport)
  }
}

describe('router-integrated facades', () => {
  it('exports the generic runtime and only the Next App Router tracker from the Next App facade', () => {
    expectGenericRuntimeIdentity(nextAppFacade)
    expect(nextAppFacade.NextAppAutoPageTracker).toBe(NextAppAutoPageTracker)
    expect(autoPageTrackerExports(nextAppFacade)).toEqual(['NextAppAutoPageTracker'])
  })

  it('exports the generic runtime and only the Next Pages Router tracker from the Next Pages facade', () => {
    expectGenericRuntimeIdentity(nextPagesFacade)
    expect(nextPagesFacade.NextPagesAutoPageTracker).toBe(NextPagesAutoPageTracker)
    expect(autoPageTrackerExports(nextPagesFacade)).toEqual(['NextPagesAutoPageTracker'])
  })

  it('exports the generic runtime and only the React Router tracker from the React Router facade', () => {
    expectGenericRuntimeIdentity(reactRouterFacade)
    expect(reactRouterFacade.ReactRouterAutoPageTracker).toBe(ReactRouterAutoPageTracker)
    expect(autoPageTrackerExports(reactRouterFacade)).toEqual(['ReactRouterAutoPageTracker'])
  })

  it('exports the generic runtime and only the TanStack Router tracker from the TanStack facade', () => {
    expectGenericRuntimeIdentity(tanStackRouterFacade)
    expect(tanStackRouterFacade.TanStackRouterAutoPageTracker).toBe(TanStackRouterAutoPageTracker)
    expect(autoPageTrackerExports(tanStackRouterFacade)).toEqual(['TanStackRouterAutoPageTracker'])
  })
})
