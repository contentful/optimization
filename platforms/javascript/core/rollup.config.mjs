import { main, module } from '@config/rollup-config'
import pkg from './package.json' with { type: 'json' }

export default [main({ pkg }), module({ pkg })]
