// TODO: Real, non-demo implementation (stateless & stateful)
export default class Flags {
  private current: Record<string, string> | undefined

  process(changes: Array<{ key: string; value: string }>): void {
    this.current = changes.reduce((r: Record<string, string>, { key, value }) => {
      r[key] = value
      return r
    }, {})
  }

  get(key: string): string | undefined {
    return this.current?.[key]
  }

  set(key: string, value: string): void {
    this.current ? (this.current[key] = value) : (this.current = { [key]: value })
  }
}
