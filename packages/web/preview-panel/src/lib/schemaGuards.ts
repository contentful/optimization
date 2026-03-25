import type {
  ChangeArray,
  InlineVariableComponent,
  SelectedOptimizationArray,
} from '@contentful/optimization-web/api-schemas'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isSelectedOptimization(value: unknown): value is SelectedOptimizationArray[number] {
  return (
    isRecord(value) &&
    typeof value.experienceId === 'string' &&
    typeof value.variantIndex === 'number' &&
    isRecord(value.variants)
  )
}

export function isChange(value: unknown): value is ChangeArray[number] {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    typeof value.type === 'string' &&
    'value' in value &&
    isRecord(value.meta) &&
    typeof value.meta.experienceId === 'string' &&
    typeof value.meta.variantIndex === 'number'
  )
}

export function isInlineVariableComponent(value: unknown): value is InlineVariableComponent {
  return (
    isRecord(value) &&
    value.type === 'InlineVariable' &&
    typeof value.key === 'string' &&
    isRecord(value.baseline) &&
    'value' in value.baseline &&
    Array.isArray(value.variants)
  )
}
