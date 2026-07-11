import { createServer, IncomingMessage, ServerResponse } from 'http'
import type { CompanionData } from '@phoi/shared'
import { sanitizeFileName } from '@phoi/shared'

const MAX_BODY_SIZE = 1024 * 1024

export class CompanionServer {
  private server: ReturnType<typeof createServer> | null = null
  private data: CompanionData | null = null

  start(port: number = 27121) {
    this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

      if (req.method === 'OPTIONS') {
        res.writeHead(200)
        res.end()
        return
      }

      if (req.method === 'POST' && req.url === '/') {
        let body = ''
        let size = 0
        let aborted = false
        req.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > MAX_BODY_SIZE) {
            if (!aborted) {
              aborted = true
              res.writeHead(413)
              res.end(JSON.stringify({ error: 'body too large' }))
              req.destroy()
            }
            return
          }
          body += chunk.toString()
        })
        req.on('end', () => {
          if (aborted) return
          try {
            const parsed = JSON.parse(body)
            const name = parsed.name || ''
            const cleanName = sanitizeFileName(name) || 'problem'
            const tests = parsed.tests || []
            const result = {
              success: true,
              filename: `${cleanName}.cpp`,
              name,
              url: parsed.url || '',
              tests,
              timeLimit: parsed.timeLimit || 0,
              memoryLimit: parsed.memoryLimit || 0
            }
            this.data = result
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(result))
          } catch {
            res.writeHead(400)
            res.end(JSON.stringify({ error: 'invalid json' }))
          }
        })
        return
      }

      if (req.method === 'GET' && req.url === '/data') {
        if (!this.data) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, message: 'no new data' }))
          return
        }
        const result = this.data
        this.data = null
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
        return
      }

      res.writeHead(404)
      res.end()
    })

    this.server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Companion server port ${port} already in use`)
      } else {
        console.error(`Companion server error: ${err.message}`)
      }
    })
    this.server.listen(port, '127.0.0.1')
    console.log(`Companion server running on http://127.0.0.1:${port}`)
  }

  stop() {
    if (this.server) {
      this.server.close()
      this.server = null
    }
  }
}
