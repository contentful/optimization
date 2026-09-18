import type { Change, VariableChange } from './Change'

/**
 * Determines whether a change represents a variable-backed optimization.
 *
 * @public
 */
export function isVariableChange(change: Change): change is VariableChange {
  return change.type === 'Variable'
}
