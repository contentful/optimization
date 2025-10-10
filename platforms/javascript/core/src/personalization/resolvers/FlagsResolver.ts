import type { ChangeArray, Flags, VariableChange } from '../../lib/api-client/experience/dto/change'

const FlagsResolver = {
  resolve(changes: ChangeArray): Flags {
    return changes
      .filter((change): change is VariableChange => change.type === 'Variable')
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

export default FlagsResolver
