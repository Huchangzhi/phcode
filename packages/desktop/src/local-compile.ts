import { execFile, spawn } from 'child_process'
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync, existsSync } from 'fs'
import { join, dirname, delimiter } from 'path'
import { tmpdir } from 'os'

const MEMORY_LIMIT_MB = 512
const RUN_TIMEOUT_SECONDS = 1
const HIDE_WINDOW = process.platform === 'win32'

function augmentPathEnv(toolPath: string): NodeJS.ProcessEnv {
  const env = { ...process.env }
  const dir = dirname(toolPath)
  if (existsSync(dir)) {
    env.PATH = `${dir}${delimiter}${env.PATH || ''}`
  }
  return env
}

export async function runLocally(code: string, stdin: string, compilerPath: string) {
  const tempDir = mkdtempSync(join(tmpdir(), 'phcode_'))
  const sourcePath = join(tempDir, 'source.cpp')
  const execPath = join(tempDir, 'program.exe')

  const response = { Result: '', Errors: '', Warnings: '', Stats: '' }

  try {
    writeFileSync(sourcePath, code, 'utf-8')

    const compilerDir = dirname(compilerPath)
    const compileResult = await new Promise<{ ok: boolean; stderr: string }>((resolve) => {
      execFile(compilerPath, [sourcePath, '-o', execPath, '-O2', '-g', '-Wall', '-std=c++14', '-DONLINE_JUDGE'],
        { timeout: 10000, cwd: compilerDir, windowsHide: HIDE_WINDOW, env: augmentPathEnv(compilerPath) },
        (err: any, _stdout: string, stderr: string) => {
          if (err) {
            resolve({ ok: false, stderr: stderr || err.message })
          } else {
            resolve({ ok: true, stderr })
          }
        })
    })

    if (!compileResult.ok) {
      response.Errors = compileResult.stderr || 'Compiler exited with an error (no diagnostic output)'
      response.Stats = 'Compilation Failed.'
    } else {
      if (compileResult.stderr) {
        response.Warnings = compileResult.stderr
      }

      const start = Date.now()
      const runResult = await new Promise<{ stdout: string; stderr: string; timedOut: boolean; signal: string | null }>((resolve) => {
        const memKB = MEMORY_LIMIT_MB * 1024
        const useMemLimit = process.platform === 'linux' || process.platform === 'darwin'
        const child = useMemLimit
          ? spawn('sh', ['-c', `ulimit -v ${memKB} 2>/dev/null && exec "$1"`, 'sh', execPath], {
              stdio: ['pipe', 'pipe', 'pipe'],
            })
          : spawn(execPath, [], {
              windowsHide: HIDE_WINDOW,
              stdio: ['pipe', 'pipe', 'pipe'],
            })
        let stdout = ''
        let stderr = ''
        let timedOut = false
        const timer = setTimeout(() => {
          timedOut = true
          child.kill()
        }, RUN_TIMEOUT_SECONDS * 1000)
        child.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
        child.stderr.on('data', (data: Buffer) => { stderr += data.toString() })
        child.on('error', (_err: any) => {
          clearTimeout(timer)
          resolve({ stdout, stderr: _err.message, timedOut: false, signal: null })
        })
        child.on('close', (_code: number | null, _signal: string | null) => {
          clearTimeout(timer)
          if (timedOut) {
            resolve({ stdout: '', stderr: '', timedOut: true, signal: null })
          } else {
            resolve({ stdout, stderr, timedOut: false, signal: _signal })
          }
        })
        if (stdin) {
          child.stdin.write(stdin)
        }
        child.stdin.end()
      })

      const duration = (Date.now() - start) / 1000
      response.Result = runResult.stdout
      if (runResult.timedOut) {
        response.Errors = `[Error] Execution Timed Out (Limit: ${RUN_TIMEOUT_SECONDS}s)`
        response.Stats = 'Time Limit Exceeded'
      } else if (runResult.signal) {
        response.Errors = `[Runtime Error] Process terminated by signal ${runResult.signal}`
        if (runResult.stderr) {
          response.Errors += `\n${runResult.stderr}`
        }
        response.Stats = `Run time: ${duration.toFixed(2)}s | Mem Limit: ${MEMORY_LIMIT_MB}MB`
      } else {
        if (runResult.stderr) {
          if (runResult.stderr.includes('std::bad_alloc') || runResult.stderr.includes('MemoryError')) {
            response.Errors = `[Error] Memory Limit Exceeded (${MEMORY_LIMIT_MB}MB)`
          } else {
            response.Errors = `[Runtime Error]\n${runResult.stderr}`
          }
        }
        response.Stats = `Run time: ${duration.toFixed(2)}s | Mem Limit: ${MEMORY_LIMIT_MB}MB`
      }
    }
  } catch (err: any) {
    response.Errors = `Server Internal Error: ${err.message}`
  }

  try { unlinkSync(sourcePath) } catch { }
  try { unlinkSync(execPath) } catch { }
  try { rmdirSync(tempDir) } catch { }

  return response
}
