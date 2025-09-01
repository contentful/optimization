import { CoreStateful, EventBuilder } from '@contentful/optimization-core'

declare global {
  interface Window {
    Optimization?: typeof Optimization
    optimization?: Optimization
  }
}

// TODO: Decorate builder to automatically gather page data and such
const builder = new EventBuilder({
  channel: 'server',
  library: { name: 'Optimization Web API', version: '0.1.0' },
})

class Optimization extends CoreStateful {
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

    window.optimization ??= this
  }
}

window.Optimization ??= Optimization

export default Optimization
