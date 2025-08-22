import mapper from './Mapper'

abstract class AudienceBase {
  readonly mapper: typeof mapper

  constructor() {
    this.mapper = mapper
  }
}

export default AudienceBase
