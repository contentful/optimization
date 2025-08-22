abstract class FlagsBase {
  protected current: Record<string, string> | undefined

  get(key: string): string | undefined {
    return this.current?.[key]
  }

  set(key: string, value: string): void {
    this.current ? (this.current[key] = value) : (this.current = { [key]: value })
  }
}

export default FlagsBase
