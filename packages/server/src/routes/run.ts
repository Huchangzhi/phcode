import { Router } from 'express'
import { checkSecurity, runOnRextester, type RunRequest } from '@phoi/shared'

const router = Router()

router.post('/', async (req, res) => {
  try {
    const { code, input } = req.body as RunRequest

    if (!code || typeof code !== 'string') {
      res.status(400).json({ Result: '', Errors: 'Missing or invalid code in request body', Warnings: '', Stats: '' })
      return
    }

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
})

export default router
