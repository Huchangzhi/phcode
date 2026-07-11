const DANGEROUS_WORDS = [
  'alias', 'file', 'exec', 'attach', 'core', 'symbol', 'library',
  'sharedlib', 'handle', 'jump', 'kill', 'detach', 'shell', 'make',
  'load', 'download', 'generate-core', 'add-symbol', 'delete-symbol',
  'call', 'return', 'python', 'py', 'pi', 'compile', 'target',
  'define', 'pipe', 'exec-wrapper',
]

export function checkGdbCommand(command: string): { safe: boolean; message?: string } {
  const trimmed = command.trim()
  if (!trimmed) {
    return { safe: true }
  }

  if (trimmed.startsWith('!')) {
    return { safe: false, message: '禁止使用 shell 逃逸命令 (!)' }
  }

  if (/[|><;`]/.test(trimmed)) {
    return { safe: false, message: '命令包含非法字符' }
  }
  if (/\$\(/.test(trimmed)) {
    return { safe: false, message: '禁止使用命令替换 $()' }
  }

  const normalized = trimmed.toLowerCase()

  for (const word of DANGEROUS_WORDS) {
    if (normalized === word) {
      return { safe: false, message: `禁止使用命令：${word}` }
    }
    const spaced = ' ' + word + ' '
    const tabbed = '\t' + word + ' '
    const tabbed2 = ' ' + word + '\t'
    const tabbed3 = '\t' + word + '\t'
    if (normalized.includes(spaced) || normalized.includes(tabbed) || normalized.includes(tabbed2) || normalized.includes(tabbed3)) {
      return { safe: false, message: `禁止使用命令：${word}` }
    }
    const wordParen = word + '('
    if (normalized.includes(wordParen)) {
      return { safe: false, message: `禁止调用 ${word}()` }
    }
  }

  const parts = normalized.split(/\s+/)
  if (parts.length > 0 && DANGEROUS_WORDS.includes(parts[0])) {
    return { safe: false, message: `禁止使用命令：${parts[0]}` }
  }

  return { safe: true }
}
