import { useCallback, useMemo, useState } from 'react'

interface UseCollapsibleControlParams {
  /** Whether collapsibles should be open by default */
  initiallyOpen?: boolean
}

interface UseCollapsibleControlResult {
  /** Toggle a specific collapsible by ID */
  toggleCollapsible: (id: string) => void
  /** Toggle all collapsibles at once */
  toggleAllCollapsibles: () => void
  /** Check if a specific collapsible is open */
  isCollapsibleOpen: (id: string) => boolean
  /** Check if all collapsibles are currently open */
  allCollapsiblesOpen: boolean
  /** Initialize a new collapsible (call when mounting) */
  initializeCollapsible: (id: string) => void
  /** Set all collapsibles to a specific state */
  setAllCollapsibles: (open: boolean) => void
}

/**
 * Hook for managing collapsible state across multiple items.
 * Used to implement "Collapse All / Expand All" functionality.
 */
export const useCollapsibleControl = ({
  initiallyOpen = false,
}: UseCollapsibleControlParams = {}): UseCollapsibleControlResult => {
  const [collapsibleStates, setCollapsibleStates] = useState<Map<string, boolean>>(new Map())

  // Check if all collapsibles are open
  const allCollapsiblesOpen = useMemo(() => {
    if (collapsibleStates.size === 0) return false
    return Array.from(collapsibleStates.values()).every(Boolean)
  }, [collapsibleStates])

  // Toggle a specific collapsible
  const toggleCollapsible = useCallback(
    (id: string) => {
      setCollapsibleStates((prev) => {
        const next = new Map(prev)
        const currentValue = next.get(id) ?? initiallyOpen
        next.set(id, !currentValue)
        return next
      })
    },
    [initiallyOpen],
  )

  // Toggle all collapsibles
  const toggleAllCollapsibles = useCallback(() => {
    setCollapsibleStates((prev) => {
      const next = new Map(prev)
      const newValue = !allCollapsiblesOpen
      next.forEach((_, key) => {
        next.set(key, newValue)
      })
      return next
    })
  }, [allCollapsiblesOpen])

  // Set all collapsibles to a specific state
  const setAllCollapsibles = useCallback((open: boolean) => {
    setCollapsibleStates((prev) => {
      const next = new Map(prev)
      next.forEach((_, key) => {
        next.set(key, open)
      })
      return next
    })
  }, [])

  // Check if a specific collapsible is open
  const isCollapsibleOpen = useCallback(
    (id: string): boolean => collapsibleStates.get(id) ?? initiallyOpen,
    [collapsibleStates, initiallyOpen],
  )

  // Initialize a new collapsible
  const initializeCollapsible = useCallback(
    (id: string) => {
      setCollapsibleStates((prev) => {
        if (prev.has(id)) return prev
        const next = new Map(prev)
        next.set(id, initiallyOpen)
        return next
      })
    },
    [initiallyOpen],
  )

  return {
    toggleCollapsible,
    toggleAllCollapsibles,
    isCollapsibleOpen,
    allCollapsiblesOpen,
    initializeCollapsible,
    setAllCollapsibles,
  }
}

export default useCollapsibleControl
