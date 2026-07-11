import type { RequestHandler } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { checkSecurity, runOnRextester } from '@phoi/shared'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const serveEasyRunPage: RequestHandler = (_req, res) => {
  res.sendFile(path.resolve(__dirname, '../../../../templates/easyrun.html'))
}

export const handleEasyRunApi: RequestHandler = async (req, res) => {
  try {
    const urlParam = req.query.url
    if (!urlParam || typeof urlParam !== 'string') {
      res.status(400).json({ Errors: 'Missing or invalid code in URL parameter' })
      return
    }
    const code = decodeURIComponent(urlParam)
    const input = req.query.stdin as string || ''

    const security = checkSecurity(code)
    if (!security.safe) {
      res.json({
        Result: '',
        Errors: security.message,
        Warnings: '',
        Stats: 'Compilation aborted due to security violation.',
      })
      return
    }

    const result = await runOnRextester({ code, input })
    res.json(result)
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      res.status(504).json({
        Result: '',
        Errors: 'Server Timeout: 请求编译器超时，请稍后重试。',
        Warnings: '',
        Stats: 'Request Timeout',
      })
      return
    }
    res.status(500).json({ Result: '', Errors: `Internal Server Error: ${err.message}`, Warnings: '', Stats: '' })
  }
}
