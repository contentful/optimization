import { parse } from 'dotenv'
import { existsSync, readFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, 'public')
const DEFAULT_PORT = 3000
const PORT = Number(process.env.APP_PORT ?? DEFAULT_PORT)

const envFile = existsSync('.env') ? '.env' : '.env.example'
const env = parse(readFileSync(envFile))

const ENVIRONMENT_SCRIPT = `<script>\nwindow.ENVIRONMENT = ${JSON.stringify(env, null, 2)}\n</script>`

const HTTP_OK = 200

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.map': 'application/json',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

function injectEnvironment(html: string): string {
  return html.replace('<script>/* replaced by server */</script>', ENVIRONMENT_SCRIPT)
}

function serveFile(filePath: string, res: ServerResponse): void {
  const ext = extname(filePath)
  const mime = MIME[ext] ?? 'application/octet-stream'

  try {
    const raw = readFileSync(filePath)

    if (ext === '.html') {
      const body = injectEnvironment(raw.toString('utf8'))
      res.writeHead(HTTP_OK, { 'Content-Type': mime })
      res.end(body)
    } else {
      res.writeHead(HTTP_OK, { 'Content-Type': mime })
      res.end(raw)
    }
  } catch {
    // SPA fallback — serve index.html for unknown paths
    const index = resolve(ROOT, 'index.html')
    const body = injectEnvironment(readFileSync(index).toString('utf8'))
    res.writeHead(HTTP_OK, { 'Content-Type': 'text/html' })
    res.end(body)
  }
}

const server = createServer((_req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(_req.url ?? '/', `http://localhost:${PORT}`)
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname
  serveFile(resolve(ROOT, pathname.slice(1)), res)
})

server.listen(PORT, () => {
  process.stdout.write(`Web SDK reference app running at http://localhost:${PORT}\n`)
})
