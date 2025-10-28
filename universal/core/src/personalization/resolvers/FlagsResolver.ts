import type { ChangeArray, Flags } from '@contentful/optimization-api-client'

const FlagsResolver = {
  resolve(changes?: ChangeArray): Flags {
    if (!changes) return {}

    return (
      changes
        // .filter((change): change is VariableChange => change.type === 'Variable')
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
    )
  },
}

export default FlagsResolver
