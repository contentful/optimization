import React, { createContext, useContext, type ReactNode } from 'react'
import { useProfileOverrides } from '../hooks/useProfileOverrides'
import type { OverrideState, PreviewActions } from '../types'

interface PreviewOverrideContextValue {
  overrides: OverrideState
  actions: PreviewActions
}

const PreviewOverrideContext = createContext<PreviewOverrideContextValue | null>(null)

/**
 * Returns the preview override state and actions from the nearest `PreviewOverrideProvider`.
 *
 * @returns The current override state and action handlers
 *
 * @throws Error if called outside of a `PreviewOverrideProvider`
 *
 * @internal
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
 * Hosts preview override state and SDK registration logic, allowing the
 * `PreviewPanel` to be unmounted/remounted without losing state.
 *
 * @param props - Provider props
 * @returns A context provider wrapping the children
 *
 * @remarks
 * Typically wrapped by {@link PreviewPanelOverlay} — not used directly.
 *
 * @internal
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
