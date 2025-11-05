class ValuePresence {
  readonly #map: Map<string | undefined, Set<unknown>>

  constructor(defaultMap?: Record<string, unknown[]>) {
    const map = new Map<string | undefined, Set<unknown>>()

    if (defaultMap)
      Object.entries(defaultMap).map(([scope, values]) =>
        map.set(scope.length ? scope : undefined, new Set(values)),
      )

    this.#map = map
  }

  isPresent(scope: string | undefined, value: unknown): boolean {
    return this.#map.get(scope)?.has(value) ?? false
  }

  addValue(scope: string | undefined, value: unknown): void {
    const values = this.#map.get(scope)

    if (!values) {
      this.#map.set(scope, new Set([value]))
    } else {
      values.add(value)
    }
  }

  removeValue(scope: string | undefined, value: unknown): void {
    this.#map.get(scope)?.delete(value)
  }

  reset(scope?: string): void {
    if (scope !== undefined) {
      this.#map.get(scope)?.clear()
    } else {
      this.#map.clear()
    }
  }
}

export default ValuePresence
