import type { LogLevels } from 'diary'

import { Logger } from './Logger'
import LogSink from './LogSink'

export * from './ConsoleLogSink'
export * from './Logger'
export * from './LogSink'

export { LogSink, type LogLevels }

export default Logger
