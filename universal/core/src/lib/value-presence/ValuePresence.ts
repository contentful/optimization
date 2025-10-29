class ValuePresence {
  readonly #map: Map<string, Set<unknown>>

  constructor(defaultMap?: Record<string, unknown[]>) {
    const map = new Map<string, Set<unknown>>()

    if (defaultMap)
      Object.entries(defaultMap).map(([context, values]) => map.set(context, new Set(values)))

    this.#map = map
  }

  isPresent(context: string, value: unknown): boolean {
    return this.#map.get(context)?.has(value) ?? false
  }

  addValue(context: string, value: unknown): void {
    const values = this.#map.get(context)

    if (!values) {
      this.#map.set(context, new Set([value]))
    } else {
      values.add(value)
    }
  }
}

export default ValuePresence
