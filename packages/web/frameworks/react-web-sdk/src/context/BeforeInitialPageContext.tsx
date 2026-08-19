import { createContext, useContext } from 'react'

export const BeforeInitialPageContext = createContext(true)

export function useBeforeInitialPageReady(): boolean {
  return useContext(BeforeInitialPageContext)
}
