import { REXTESTER_URL, LANG_CPP_GCC, COMPILER_ARGS, REXTESTER_TIMEOUT } from './constants.js'
import type { RunRequest, RunResponse } from './types.js'
import { checkSecurity } from './security.js'

function buildPayload({ code, input, compilerArgs }: RunRequest & { compilerArgs?: string }): URLSearchParams {
  const params = new URLSearchParams()
  params.set('LanguageChoiceWrapper', String(LANG_CPP_GCC))
  params.set('Program', code)
  params.set('Input', input ?? '')
  params.set('CompilerArgs', compilerArgs ?? COMPILER_ARGS)
  return params
}

export async function runOnRextester(request: RunRequest): Promise<RunResponse> {
  const sec = checkSecurity(request.code)
  if (!sec.safe) {
    return { Errors: sec.message, Result: '', Warnings: '', Stats: 'Compilation aborted due to security violation.' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REXTESTER_TIMEOUT)

  try {
    const resp = await fetch(REXTESTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      body: buildPayload(request),
      signal: controller.signal,
    })

    if (!resp.ok) {
      throw new Error(`Rextester returned ${resp.status}`)
    }

    return await resp.json() as RunResponse
  } finally {
    clearTimeout(timer)
  }
}
