import { emitDualDts } from './emitDualDts'

function printUsage(): void {
  process.stderr.write(
    'Usage: build-tools emit-dual-dts [distDir]\n' + 'Example: build-tools emit-dual-dts ./dist\n',
  )
}

export function main(argv: string[]): void {
  const [command, distDir = './dist'] = argv

  if (command !== 'emit-dual-dts') {
    printUsage()
    process.exitCode = 1
    return
  }

  emitDualDts(distDir)
}

main(process.argv.slice(2))
