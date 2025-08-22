import mapper from './Mapper'

abstract class ExperimentsBase {
  readonly mapper: typeof mapper

  constructor() {
    this.mapper = mapper
  }
}

export default ExperimentsBase
