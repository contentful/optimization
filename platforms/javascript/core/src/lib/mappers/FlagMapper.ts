import type {
  ChangeArrayType,
  Flags,
  VariableChangeType,
} from '../api-client/experience/dto/change'

const FlagMapper = {
  mapFlags(changes: ChangeArrayType): Flags {
    return changes
      .filter((change): change is VariableChangeType => change.type === 'Variable')
      .reduce<Flags>((acc, { key, value }) => {
        const actualValue =
          typeof value === 'object' &&
          value !== null &&
          'value' in value &&
          typeof value.value === 'object'
            ? value.value
            : value

        acc[key] = actualValue

        return acc
      }, {})
  },
}

export default FlagMapper
