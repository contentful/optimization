import Core from '@contentful/optimization-core'

declare global {
  interface Window {
    Optimization?: typeof Optimization
    optimization?: Optimization
  }
}

class Optimization extends Core {
  constructor() {
    super({ name: 'Optimization' })

    // eslint-disable-next-line no-console -- demo
    console.log(this.name)

    window.optimization ??= this
  }
}

window.Optimization ??= Optimization

export default Optimization
