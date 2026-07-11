import { spawn, execFile } from 'child_process'
import { mkdtempSync, writeFileSync, existsSync, unlinkSync, rmdirSync, readdirSync } from 'fs'
import { join, dirname, delimiter } from 'path'
import { tmpdir } from 'os'
import { EventEmitter } from 'events'

const HIDE_WINDOW = process.platform === 'win32'

export class DebugManager extends EventEmitter {
  private debugProcess: any = null
  private _status: 'idle' | 'compiling' | 'busy' = 'idle'
  private _pairingCode: string | null = null
  private tempDir: string | null = null
  sourcePath: string | null = null
  executablePath: string | null = null
  get status() { return this._status }
  get pairingCode() { return this._pairingCode }

  generatePairingCode(): string {
    this._pairingCode = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('')
    return this._pairingCode
  }

  async startSession(code: string, pairingCode: string, compilerPath = 'g++', gdbPath = 'gdb'): Promise<{ success: boolean; message: string }> {
    if (this._status !== 'idle') return { success: false, message: '调试器繁忙' }

    this._pairingCode = pairingCode
    this._status = 'compiling'

    this.tempDir = mkdtempSync(join(tmpdir(), 'phcode_debug_'))
    this.sourcePath = join(this.tempDir, 'source.cpp')
    this.executablePath = join(this.tempDir, 'program.exe')

    try {
      writeFileSync(this.sourcePath, code, 'utf-8')

      const result = await this.compile(compilerPath)
      if (!result.success) {
        this._status = 'idle'
        this.cleanup()
        return result
      }

      this.startGdb(gdbPath)
      return { success: true, message: '调试已启动' }
    } catch (err: any) {
      this._status = 'idle'
      this.cleanup()
      return { success: false, message: `错误：${err.message}` }
    }
  }

  private compile(compilerPath: string): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const compileCmd = [this.sourcePath!, '-o', this.executablePath!, '-g', '-O0', '-Wall', '-std=c++14']

      const compileEnv = { ...process.env }
      const compilerDir = dirname(compilerPath)
      compileEnv.PATH = `${compilerDir}${delimiter}${compileEnv.PATH || ''}`
      execFile(compilerPath, compileCmd, { timeout: 30000, cwd: compilerDir, windowsHide: HIDE_WINDOW, env: compileEnv }, (err, _stdout, stderr) => {
        if (err) {
          resolve({ success: false, message: `编译失败：${stderr || err.message}` })
        } else {
          if (stderr) this.emit('output', `[警告] ${stderr}\n`)
          resolve({ success: true, message: '' })
        }
      })
    })
  }

  private startGdb(gdbPath: string) {
    const env = { ...process.env }
    const gdbDir = dirname(gdbPath)
    env.PATH = `${gdbDir}${delimiter}${env.PATH || ''}`

    this.debugProcess = spawn(gdbPath, ['-q', this.executablePath!], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: gdbDir,
      env,
      windowsHide: HIDE_WINDOW,
    })

    this._status = 'busy'

    this.debugProcess.stdin.write('set pagination off\n')
    this.debugProcess.stdin.write('set max-value-size unlimited\n')

    this.emit('output', `[调试] GDB 已启动，配对码：${this._pairingCode}\n`)
    this.emit('output', `[调试] 可执行文件：${this.executablePath}\n`)
    this.emit('output', `[调试] 源码路径：${this.sourcePath}\n`)
    this.emit('output', "[调试] 输入 'help' 查看可用命令，输入 'quit' 退出调试\n\n")

    this.debugProcess.stdout.on('data', (data: Buffer) => {
      const text = data.toString('utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      this.emit('output', text)
    })

    this.debugProcess.stderr.on('data', (data: Buffer) => {
      this.emit('output', data.toString('utf-8'))
    })

    this.debugProcess.on('error', (err: Error) => {
      this.emit('output', `[错误] 启动 GDB 失败：${err.message}\n`)
      this.cleanup()
    })

    this.debugProcess.on('exit', () => {
      if (this._status !== 'idle') {
        this.cleanup()
      }
    })
  }

  sendCommand(command: string): boolean {
    if (this.debugProcess && this._status === 'busy') {
      try {
        this.debugProcess.stdin.write(command + '\n')
        return true
      } catch { }
    }
    return false
  }

  stop() {
    const proc = this.debugProcess
    if (proc) {
      this.debugProcess = null
      try {
        proc.stdin.write('quit\n')
        setTimeout(() => {
          try { proc.kill() } catch { }
        }, 2000)
      } catch {
        try { proc.kill() } catch { }
      }
    }
    this.cleanup()
  }

  private cleanup() {
    const wasRunning = this._status === 'busy'
    this._status = 'idle'
    this._pairingCode = null
    if (wasRunning) {
      this.emit('output', '[调试] 调试会话已结束\n')
    }

    if (this.tempDir && existsSync(this.tempDir)) {
      try {
        for (const f of readdirSync(this.tempDir)) {
          try { unlinkSync(join(this.tempDir, f)) } catch { }
        }
        rmdirSync(this.tempDir)
      } catch { }
    }
  }
}
