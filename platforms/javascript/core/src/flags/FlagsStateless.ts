import FlagsBase from './FlagsBase'

class FlagsStateless extends FlagsBase {
  process(changes: Array<{ key: string; value: string }>): void {
    this.current = changes.reduce((r: Record<string, string>, { key, value }) => {
      r[key] = value
      return r
    }, {})
  }
}

export default FlagsStateless
