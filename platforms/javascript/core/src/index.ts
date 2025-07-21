/** Options that may be passed to the Core constructor */
export interface CoreOptions {
  /** The name of the SDK built from this Core class (added as an example only) */
  name: string
}

export abstract class Core {
  readonly options: Omit<CoreOptions, 'name'>
  readonly name: string

  constructor(options: CoreOptions) {
    const { name, ...rest } = options

    this.name = name
    this.options = rest
  }
}
