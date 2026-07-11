import { readFileSync, writeFileSync, readdirSync, unlinkSync, renameSync, existsSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { randomBytes } from 'crypto'

const STORAGE_EXTENSIONS = ['.cpp', '.c', '.h', '.hpp', '.cxx', '.cc']

export class StorageManager {
  private tokens = new Set<string>()
  private _root: string | null = null
  readonly appSecret: string
  private configPath: string

  constructor(configPath: string) {
    this.appSecret = randomBytes(16).toString('hex')
    this.configPath = join(configPath, 'storage_config.json')
    this.loadConfig()
  }

  get root() { return this._root }
  set root(path: string | null) { this._root = path }

  get hasRoot() { return this._root !== null }
  get hasToken() { return this.tokens.size > 0 }

  initToken(clientSecret: string): string | null {
    if (!clientSecret || clientSecret !== this.appSecret) return null
    const token = randomBytes(32).toString('hex')
    this.tokens.add(token)
    return token
  }

  validateToken(token: string): boolean {
    return this.tokens.has(token)
  }

  selectDir(path: string): boolean {
    if (path && existsSync(path) && statSync(path).isDirectory()) {
      this._root = path
      this.saveConfig()
      return true
    }
    return false
  }

  listFiles(): string[] {
    if (!this._root) return []
    try {
      return readdirSync(this._root)
        .filter(f => STORAGE_EXTENSIONS.some(ext => f.endsWith(ext)))
        .sort()
    } catch { return [] }
  }

  readFile(name: string): string | null {
    if (!this._root || !this.isValidName(name)) return null
    try {
      return readFileSync(join(this._root, name), 'utf-8')
    } catch { return null }
  }

  writeFile(name: string, content: string): boolean {
    if (!this._root || !this.isValidName(name)) return false
    try {
      writeFileSync(join(this._root, name), content, 'utf-8')
      return true
    } catch { return false }
  }

  deleteFile(name: string): boolean {
    if (!this._root || !this.isValidName(name)) return false
    try {
      unlinkSync(join(this._root, name))
      return true
    } catch { return false }
  }

  renameFile(oldName: string, newName: string): boolean {
    if (!this._root || !this.isValidName(oldName) || !this.isValidName(newName)) return false
    try {
      renameSync(join(this._root, oldName), join(this._root, newName))
      return true
    } catch { return false }
  }

  private isValidName(name: string): boolean {
    if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\')) return false
    const resolved = resolve(this._root!, name)
    if (!resolved.startsWith(resolve(this._root!))) return false
    return true
  }

  private saveConfig() {
    try {
      writeFileSync(this.configPath, JSON.stringify({ root: this._root }), 'utf-8')
    } catch { }
  }

  private loadConfig() {
    try {
      if (existsSync(this.configPath)) {
        const data = JSON.parse(readFileSync(this.configPath, 'utf-8'))
        this._root = data.root || null
      }
    } catch { }
  }
}
