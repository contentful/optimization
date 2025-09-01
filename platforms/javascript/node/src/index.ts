import { CoreStateless, EventBuilder } from '@contentful/optimization-core'

const builder = new EventBuilder({
  channel: 'server',
  library: { name: 'Optimization Node API', version: '0.1.0' },
})

class Optimization extends CoreStateless {
  constructor() {
    super(
      {
        name: 'Optimization',
        clientId: 'temp',
      },
      builder,
    )

    // eslint-disable-next-line no-console -- demo
    console.log(this.name)
  }
}

export default Optimization
