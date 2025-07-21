import { Core } from '@contentful/optimization-core'

export default class WebSDK extends Core {
  constructor() {
    super({ name: 'WebSDK' })

    // eslint-disable-next-line no-console -- debug
    console.log(this.name)
  }
}
