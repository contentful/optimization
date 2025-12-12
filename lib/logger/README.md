# Contentful Optimization SDK Logger Implementation

> [!WARNING]
>
> This is an internal-only package that is not intended for publishing outside this monorepo

The Optimization SDK Logger implementation is based on [Diary](https://github.com/maraisr/diary). It
supplies a default `ConsoleLogSink` for logging to the console, and also supports the addition of
other logging sinks.

## Usage

```ts
import { logger, LogSink, type LogEvent } from 'logger'

class MySink extends LogSink {
  constructor() {
    super()
    // Setup code
  }

  ingest(event: LogEvent): void {
    // Your logging logic
  }
}

const mySink = new MySink()

logger.addSink(mySink)

logger.info('Something informative')

logger.removeSink(mySink.name)
```
