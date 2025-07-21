import { Core } from '@contentful/optimization-core'

export default class NodeSDK extends Core {
  constructor() {
    super({ name: 'NodeSDK' })

    // eslint-disable-next-line no-console -- debug
    console.log(this.name)
  }
}
