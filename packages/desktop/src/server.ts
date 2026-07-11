import express, { type RequestHandler } from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createInterface } from 'readline'
import { checkSecurity, runOnRextester } from '@phoi/shared'
import { DebugManager } from './debug/manager.js'
import { checkGdbCommand } from './debug/security.js'
import { StorageManager } from './storage/manager.js'
import { runLocally } from './local-compile.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function showDebugConfirmDialog(pairingCode: string): Promise<boolean> {
  if (process.platform === 'win32') {
    const script = `Add-Type -AssemblyName System.Windows.Forms
$r = [System.Windows.Forms.MessageBox]::Show('有人想要启动调试功能\n\n配对码：${pairingCode}\n\n\u26a0\ufe0f 安全警告：\n调试功能允许执行任意代码，可能访问系统资源。\n请确保代码来源可信！\n\n是否允许启动调试？', '调试安全确认', 'YesNo', 'Warning')
if ($r -eq 'Yes') { exit 0 } else { exit 1 }`
    try {
      const encoded = Buffer.from(script, 'utf16le').toString('base64')
      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand "${encoded}"`, { timeout: 60000, windowsHide: true })
      return Promise.resolve(true)
    } catch {
      return Promise.resolve(false)
    }
  }

  try {
    if (process.platform === 'darwin') {
      execSync(`osascript -e 'display dialog "有人想要启动调试功能\n\n配对码：${pairingCode}\n\n⚠️ 安全警告：\n调试功能允许执行任意代码，可能访问系统资源。\n请确保代码来源可信！\n\n是否允许启动调试？" buttons {"否","是"} default button "否" with icon caution'`, { timeout: 60000 })
      return Promise.resolve(true)
    }
    execSync(`zenity --question --title="调试安全确认" --text="有人想要启动调试功能\n\n配对码：${pairingCode}\n\n⚠️ 安全警告：\n调试功能允许执行任意代码，可能访问系统资源。\n请确保代码来源可信！\n\n是否允许启动调试？" --width=400`, { timeout: 60000 })
    return Promise.resolve(true)
  } catch {
    return new Promise((resolve) => {
      const rl = createInterface({ input: process.stdin, output: process.stdout })
      console.log(`\n⚠️ 有人想要启动调试功能，配对码：${pairingCode}`)
      console.log('⚠️ 安全警告：调试功能允许执行任意代码，可能访问系统资源。')
      rl.question('是否允许启动调试？(y/n): ', (answer: string) => {
        rl.close()
        resolve(answer.toLowerCase().trim() === 'y')
      })
    })
  }
}

export function createDesktopApp(
  debugManager: DebugManager,
  storageManager: StorageManager,
  compilerPath: string,
  gdbPath: string,
  useLocalCompiler: boolean,
) {
  const app = express()

  app.use(cors({ origin: '*' }))
  app.use(express.json({ limit: '1mb' }))
  app.use((_req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
    next()
  })

  const frontendDist = existsSync(path.resolve(__dirname, '../../frontend/dist/index.html'))
    ? path.resolve(__dirname, '../../frontend/dist')
    : existsSync(path.resolve(path.dirname(process.execPath), 'index.html'))
      ? path.dirname(process.execPath)
      : path.resolve(__dirname, '../../frontend/dist')
  app.use(express.static(frontendDist, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('.wasm')) {
        res.setHeader('Content-Type', 'application/wasm')
      }
    },
  }))

  const rootStatic = existsSync(path.resolve(__dirname, '../../../static/data'))
    ? path.resolve(__dirname, '../../../static')
    : frontendDist
  app.use('/static', express.static(rootStatic))

  const easyrunHtml = existsSync(path.resolve(__dirname, '../../../templates/easyrun.html'))
    ? path.resolve(__dirname, '../../../templates/easyrun.html')
    : path.resolve(path.dirname(process.execPath), 'templates/easyrun.html')
  app.get('/easyrun', (_req, res) => {
    res.sendFile(easyrunHtml, (err) => {
      if (err) res.status(404).json({ error: 'easyrun.html not found' })
    })
  })

  async function handleRunRequest(req: any, res: any) {
    try {
      const { code, input } = req.body
      if (!code?.trim()) {
        res.status(400).json({ Errors: 'Code is empty', Result: '', Warnings: '', Stats: '' })
        return
      }
      const security = checkSecurity(code)
      if (!security.safe) {
        res.json({ Errors: security.message, Result: '', Stats: 'Compilation aborted due to security violation.' })
        return
      }
      if (useLocalCompiler) {
        const result = await runLocally(code, input || '', compilerPath)
        res.json(result)
      } else {
        const result = await runOnRextester({ code, input })
        res.json(result)
      }
    } catch (err: any) {
      res.status(500).json({ Errors: err.message })
    }
  }

  app.post('/run', handleRunRequest)
  app.post('/api/run', handleRunRequest)

  app.get('/easyrun_api', async (req, res) => {
    try {
      const urlParam = req.query.url
      const code = typeof urlParam === 'string' ? decodeURIComponent(urlParam) : ''
      if (!code.trim()) {
        res.status(400).json({ Errors: 'Missing or empty code in URL parameter', Result: '', Stats: '' })
        return
      }
      const input = req.query.stdin as string || ''
      const security = checkSecurity(code)
      if (!security.safe) {
        res.json({ Errors: security.message, Result: '', Stats: 'Compilation aborted due to security violation.' })
        return
      }
      const result = useLocalCompiler
        ? await runLocally(code, input, compilerPath)
        : await runOnRextester({ code, input })
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ Errors: err.message })
    }
  })

  app.get('/debug/status', (_req, res) => {
    res.json({ status: debugManager.status, pairingCode: debugManager.pairingCode })
  })

  app.post('/debug/start', async (req, res) => {
    try {
      const code = req.body.code
      if (!code?.trim()) {
        res.json({ success: false, message: '代码不能为空' })
        return
      }
      const pairingCode = String(req.body.pairingCode || req.body.pairing_code || '')
      if (!/^\d{6}$/.test(pairingCode)) {
        res.json({ success: false, message: '配对码必须是 6 位数字' })
        return
      }
      const security = checkSecurity(code)
      if (!security.safe) {
        res.json({ success: false, message: security.message })
        return
      }
      const confirmed = await showDebugConfirmDialog(pairingCode)
      if (!confirmed) {
        res.json({ success: false, message: '用户取消了调试' })
        return
      }
      const result = await debugManager.startSession(code, pairingCode, compilerPath, gdbPath)
      res.json(result)
    } catch (err: any) {
      res.json({ success: false, message: `错误：${err.message}` })
    }
  })

  app.post('/debug/stop', (_req, res) => {
    try {
      debugManager.stop()
      res.json({ success: true, message: '调试已停止' })
    } catch (err: any) {
      res.json({ success: false, message: `错误：${err.message}` })
    }
  })

  app.post('/debug/command', (req, res) => {
    try {
      const command = req.body.command
      const pairingCode = String(req.body.pairingCode || req.body.pairing_code || '')
      if (!command?.trim()) {
        res.json({ success: false, message: '命令不能为空' })
        return
      }
      if (!pairingCode || !debugManager.pairingCode || pairingCode !== debugManager.pairingCode) {
        res.json({ success: false, message: '配对码错误' })
        return
      }
      if (debugManager.status !== 'busy') {
        res.json({ success: false, message: '调试器未运行' })
        return
      }
      const check = checkGdbCommand(command)
      if (!check.safe) {
        res.json({ success: false, message: check.message })
        return
      }
      const ok = debugManager.sendCommand(command)
      res.json({ success: ok })
    } catch (err: any) {
      res.json({ success: false, message: `错误：${err.message}` })
    }
  })

  app.get('/debug/events', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    const onOutput = (text: string) => {
      res.write(`data: ${JSON.stringify(text)}\n\n`)
    }

    debugManager.on('output', onOutput)

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n')
    }, 30000)

    req.on('close', () => {
      debugManager.off('output', onOutput)
      clearInterval(heartbeat)
    })
  })

  const requireToken: RequestHandler = (req, res, next) => {
    const token = req.headers['x-phoi-storage-token'] as string
    if (!token || !storageManager.validateToken(token)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    next()
  }

  app.get('/api/storage/status', (_req, res) => {
    res.json({
      available: true,
      root: storageManager.root,
      hasRoot: storageManager.hasRoot,
      hasToken: storageManager.hasToken,
    })
  })

  app.post('/api/storage/init', (req, res) => {
    const clientSecret = req.headers['x-phoi-app-secret'] as string
    const token = storageManager.initToken(clientSecret)
    if (!token) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    res.json({ token })
  })

  app.post('/api/storage/ping', requireToken, (_req, res) => {
    res.json({ ok: true })
  })

  app.post('/api/storage/select-dir', requireToken, (_req, res) => {
    if (process.platform !== 'win32') {
      return res.status(400).json({ error: 'Not supported on this platform' })
    }
    try {
      const script = `
Add-Type -AssemblyName System.Windows.Forms
$folder = New-Object System.Windows.Forms.FolderBrowserDialog
$folder.Description = '请选择储存文件夹'
$result = $folder.ShowDialog()
if ($result -eq 'OK') { Write-Output $folder.SelectedPath } else { exit 1 }`
      const encoded = Buffer.from(script, 'utf16le').toString('base64')
      const output = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand "${encoded}"`, { timeout: 60000 })
      const dirPath = output.toString().trim()
      if (dirPath && storageManager.selectDir(dirPath)) {
        res.json({ path: dirPath })
      } else {
        res.status(400).json({ error: 'No directory selected' })
      }
    } catch {
      res.status(400).json({ error: 'No directory selected' })
    }
  })

  app.post('/api/storage/remember-root', requireToken, (req, res) => {
    const { path: dirPath } = req.body
    if (dirPath && storageManager.selectDir(dirPath)) {
      res.json({ success: true })
    } else {
      res.status(400).json({ error: 'invalid path' })
    }
  })

  app.post('/api/storage/list', requireToken, (_req, res) => {
    res.json({ files: storageManager.listFiles() })
  })

  app.post('/api/storage/read', requireToken, (req, res) => {
    const { fileName } = req.body
    const content = storageManager.readFile(fileName)
    if (content !== null) {
      res.json({ content })
    } else {
      res.status(404).json({ error: 'not found' })
    }
  })

  app.post('/api/storage/write', requireToken, (req, res) => {
    const { fileName, content } = req.body
    if (storageManager.writeFile(fileName, content)) {
      res.json({ success: true })
    } else {
      res.status(400).json({ error: 'write failed' })
    }
  })

  app.post('/api/storage/delete', requireToken, (req, res) => {
    const { fileName } = req.body
    if (storageManager.deleteFile(fileName)) {
      res.json({ success: true })
    } else {
      res.status(404).json({ error: 'not found' })
    }
  })

  app.post('/api/storage/rename', requireToken, (req, res) => {
    const { oldName, newName } = req.body
    if (storageManager.renameFile(oldName, newName)) {
      res.json({ success: true })
    } else {
      res.status(400).json({ error: 'rename failed' })
    }
  })

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '3.0.0' })
  })

  return app
}
