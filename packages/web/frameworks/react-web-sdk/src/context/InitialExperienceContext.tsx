import { createContext, useContext } from 'react'

export const InitialExperienceContext = createContext(true)

export function useInitialExperienceReady(): boolean {
  return useContext(InitialExperienceContext)
}
