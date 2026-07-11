import { checkSecurity, COMPILER_ARGS_STRICT, runOnRextester } from '@phoi/shared'

export default {
  async fetch(request: Request, env: any, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() })
    }

    if (request.method === 'POST' && url.pathname === '/run') {
      return handleRun(request)
    }

    if (request.method === 'GET' && url.pathname === '/easyrun_api') {
      return handleEasyRun(url)
    }

    if (env.ASSETS) {
      try {
        return addSecurityHeaders(await env.ASSETS.fetch(request))
      } catch {
        return new Response('Not Found', { status: 404, headers: corsHeaders() })
      }
    }
    return new Response('Not Found', { status: 404, headers: corsHeaders() })
  },
}

function corsHeaders(): Headers {
  const headers = new Headers()
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type')
  headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp')
  return headers
}

function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers)
  headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function jsonResponse(data: any, status = 200): Response {
  const headers = corsHeaders()
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(data), { status, headers })
}

async function handleRun(request: Request): Promise<Response> {
  try {
    const { code, input } = await request.json() as { code?: string; input?: string }
    if (!code) {
      return jsonResponse({ Errors: 'No code provided' }, 400)
    }
    const security = checkSecurity(code)
    if (!security.safe) {
      return jsonResponse({ Errors: security.message, Result: '', Stats: 'Compilation aborted due to security violation.' }, 400)
    }
    const result = await runOnRextester({ code, input })
    return jsonResponse(result)
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return jsonResponse({ Errors: 'Server Timeout: Request to compiler timed out, please try again later.' }, 504)
    }
    return jsonResponse({ Errors: `Internal Server Error: ${err.message}` }, 500)
  }
}

async function handleEasyRun(url: URL): Promise<Response> {
  try {
    const urlParam = url.searchParams.get('url')
    if (!urlParam) {
      return jsonResponse({ Errors: 'No code provided' }, 400)
    }
    const code = decodeURIComponent(urlParam)
    const input = url.searchParams.get('input') || ''
    const security = checkSecurity(code)
    if (!security.safe) {
      return jsonResponse({ Errors: security.message, Result: '', Stats: 'Compilation aborted due to security violation.' }, 400)
    }
    const result = await runOnRextester({ code, input, compilerArgs: COMPILER_ARGS_STRICT })
    return jsonResponse(result)
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return jsonResponse({ Errors: 'Server Timeout: Request to compiler timed out, please try again later.' }, 504)
    }
    return jsonResponse({ Errors: `Internal Server Error: ${err.message}` }, 500)
  }
}
