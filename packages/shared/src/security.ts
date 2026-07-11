import type { SecurityResult } from './types.js'

const DANGEROUS_PATTERNS: RegExp[] = [
  /\bsystem\b/i,
  /\bexec(?:[lv](?:[pe]e?)?)?\b/i,
  /\bfork\b/i,
  /\bpopen\b/i,
  /\bkill\b/i,
  /<windows\.h>/i,
  /<unistd\.h>/i,
  /<process\.h>/i,
  /<spawn\.h>/i,
  /<dlfcn\.h>/i,
  /<sys\//i,
  /\bfstream\b/i,
  /\bfreopen\b/i,
  /\bFILE\s*\*/i,
  /\bfopen\b/i,
  /\b__asm__\b/i,
  /\basm\b/i,
  /\bCreateProcess[AW]?\b/i,
  /\bShellExecute[AW]?\b/i,
  /\bWinExec\b/i,
  /\bdlopen\b/i,
  /\bLoadLibrary[AW]?\b/i,
  /\b_wsystem\b/i,
  /\bspawn(?:[lv](?:[pe]e?)?)?\b/i,
  /\bptrace\b/i,
  /\bsignal\b/i,
  /\braise\b/i,
  /\bexit\b/i,
  /\b_exit\b/i,
  /\batexit\b/i,
  /\bpclose\b/i,
  /\bsocket\b/i,
  /\bconnect\b/i,
  /\bbind\b/i,
  /\blisten\b/i,
  /\baccept\b/i,
  /\bsend\b/i,
  /\brecv\b/i,
  /\bsendto\b/i,
  /\brecvfrom\b/i,
  /\bgetaddrinfo\b/i,
  /\bgethostbyname\b/i,
  /\bWSAStartup\b/i,
  /\bsetsockopt\b/i,
  /\bclosesocket\b/i,
  /\b__asm\b/i,
]

export function checkSecurity(code: string): SecurityResult {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      return {
        safe: false,
        message: `Security Alert: 检测到危险代码模式: ${pattern}`,
      }
    }
  }
  return { safe: true }
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^\w\-]/g, '_')
}
