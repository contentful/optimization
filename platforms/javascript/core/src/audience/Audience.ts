// TODO: Real, non-demo implementation (stateless & stateful)
import mapper from './Mapper'

export default class Audience {
  readonly mapper: typeof mapper

  constructor() {
    this.mapper = mapper
  }
}
