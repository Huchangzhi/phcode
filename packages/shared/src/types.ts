export interface RunRequest {
  code: string
  input?: string
  compilerArgs?: string
}

export interface RunResponse {
  Result?: string
  Errors?: string
  Warnings?: string
  Stats?: string
}

export interface SecurityResult {
  safe: boolean
  message?: string
}

export interface DebugStatus {
  status: 'idle' | 'busy'
  pairingCode?: string
}

export interface DebugStartRequest {
  code: string
  pairingCode: string
}

export interface DebugCommandRequest {
  command: string
  pairingCode: string
}

export interface DebugResponse {
  success: boolean
  message?: string
}

export interface StorageStatus {
  available: boolean
  root?: string
  hasRoot: boolean
  hasToken: boolean
}

export interface StorageInitResponse {
  token: string
}

export interface StorageListResponse {
  files: string[]
}

export interface StorageReadResponse {
  content: string
}

export interface StorageWriteRequest {
  fileName: string
  content: string
}

export interface StorageSelectDirRequest {
  path: string
}

export interface StorageDeleteRequest {
  fileName: string
}

export interface StorageRenameRequest {
  oldName: string
  newName: string
}

export interface StorageRenameResponse {
  success: boolean
}

export interface CompanionData {
  name: string
  url: string
  tests: Array<{ input: string; output: string }>
  timeLimit?: number
  memoryLimit?: number
}
