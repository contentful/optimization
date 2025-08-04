import Core from '@contentful/optimization-core'

export default class Optimization extends Core {
  constructor() {
    super({ name: 'Optimization' })

    // eslint-disable-next-line no-console -- demo
    console.log(this.name)
  }
}
