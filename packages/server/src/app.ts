import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import runRouter from './routes/run.js'
import { securityHeaders } from './middleware/security.js'
import { serveEasyRunPage, handleEasyRunApi } from './routes/easyrun.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function createApp() {
  const app = express()

  app.use(cors({
    origin: (origin, callback) => {
      callback(null, origin || '*')
    },
  }))
  app.use(express.json({ limit: '1mb' }))
  app.use(securityHeaders)

  const frontendDist = path.resolve(__dirname, '../../frontend/dist')
  app.use(express.static(frontendDist, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('.wasm')) {
        res.setHeader('Content-Type', 'application/wasm')
      }
    },
  }))

  const rootStatic = path.resolve(__dirname, '../../static')
  app.use('/static', express.static(rootStatic))

  app.use('/api/run', runRouter)
  app.use('/run', runRouter)
  app.get('/', (_req, res) => {
    res.sendFile(path.resolve(__dirname, '../../frontend/dist/index.html'))
  })
  app.get('/easyrun', serveEasyRunPage)
  app.get('/easyrun_api', handleEasyRunApi)

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '3.0.0' })
  })

  app.use((_req, res) => {
    res.status(404).json({ Errors: 'Not Found' })
  })

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err)
    res.status(500).json({ Errors: `Internal Server Error: ${err.message}` })
  })

  return app
}
