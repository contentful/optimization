import React, { createContext, useContext, type ReactNode } from 'react'
import { useProfileOverrides } from '../hooks/useProfileOverrides'
import type { OverrideState, PreviewActions } from '../types'

interface PreviewOverrideContextValue {
  overrides: OverrideState
  actions: PreviewActions
}

const PreviewOverrideContext = createContext<PreviewOverrideContextValue | null>(null)

/**
 * Hook to access the preview override state and actions.
 * Must be used within a PreviewOverrideProvider.
 */
export function usePreviewOverrides(): PreviewOverrideContextValue {
  const context = useContext(PreviewOverrideContext)

  if (!context) {
    throw new Error(
      'usePreviewOverrides must be used within a PreviewOverrideProvider. ' +
        'This is typically provided by PreviewPanelOverlay.',
    )
  }

  return context
}

interface PreviewOverrideProviderProps {
  children: ReactNode
}

/**
 * Provider that manages preview override state.
 *
 * This provider hosts the override state and SDK registration logic,
 * allowing the PreviewPanel to be unmounted/remounted (e.g., when Modal closes)
 * without losing state.
 *
 * The provider should wrap the entire app content that uses PreviewPanel,
 * which is typically done by PreviewPanelOverlay.
 */
export function PreviewOverrideProvider({
  children,
}: PreviewOverrideProviderProps): React.JSX.Element {
  const { overrides, actions } = useProfileOverrides()

  return (
    <PreviewOverrideContext.Provider value={{ overrides, actions }}>
      {children}
    </PreviewOverrideContext.Provider>
  )
}

export default PreviewOverrideContext
