import { CoreStateless } from '@contentful/optimization-core'

class Optimization extends CoreStateless {
  constructor() {
    super({ name: 'Optimization', clientId: 'temp' })

    // eslint-disable-next-line no-console -- demo
    console.log(this.name)
  }
}

export default Optimization
