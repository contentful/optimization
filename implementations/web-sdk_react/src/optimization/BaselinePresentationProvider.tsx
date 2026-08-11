import { createContext, type JSX, type PropsWithChildren, useContext } from 'react'

const BaselinePresentationContext = createContext(false)

interface BaselinePresentationProviderProps extends PropsWithChildren {
  enabled: boolean
}

export function BaselinePresentationProvider({
  children,
  enabled,
}: BaselinePresentationProviderProps): JSX.Element {
  return (
    <BaselinePresentationContext.Provider value={enabled}>
      {children}
    </BaselinePresentationContext.Provider>
  )
}

export function useBaselinePresentation(): boolean {
  return useContext(BaselinePresentationContext)
}
