import Core from '@contentful/optimization-core'

class Optimization extends Core {
  constructor() {
    super({ name: 'Optimization' })

    // eslint-disable-next-line no-console -- demo
    console.log(this.name)
  }
}

export default Optimization
