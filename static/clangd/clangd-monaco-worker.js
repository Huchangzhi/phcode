// clangd-monaco-worker.js - 用于 Monaco 内置 LSP 客户端的 clangd Worker
// 使用 JSON-RPC 消息格式与 Monaco 通信
//
// stdout 解析使用上游 clangd-in-browser 的 JsonStream 状态机方案，
// 避免原实现 O(n²) 的逐字节缓冲拷贝和 Content-Length 头搜索。

console.log('[clangd-monaco-worker] Starting...');

import ClangdModule from '/static/clangd/clangd.js';

console.log('[clangd-monaco-worker] ClangdModule imported:', typeof ClangdModule);

// ---- JsonStream: 从上游 clangd-in-browser 移植 ----
// 基于 {} 嵌套深度的状态机，直接识别完整 JSON 对象，
// 无需 Content-Length 头解析和逐字节缓冲拷贝。
const QUOT = 34, LBRACE = 123, RBRACE = 125, BACKSLASH = 92;

class JsonStream {
    #inJson = false;
    #rawText = [];
    #unbalancedBraces = 0;
    #inString = false;
    #inEscape = 0;
    #textDecoder = new TextDecoder();

    insert(charCode) {
        if (!this.#inJson && charCode === LBRACE) {
            this.#inJson = true;
            this.#rawText = [];
        }
        if (!this.#inJson) return null;

        this.#rawText.push(charCode);

        if (this.#inString) {
            if (this.#inEscape) {
                if (charCode === 75) this.#inEscape += 4;
                this.#inEscape--;
            } else {
                if (charCode === BACKSLASH) this.#inEscape = 1;
                else if (charCode === QUOT) this.#inString = false;
            }
        } else {
            if (charCode === LBRACE) this.#unbalancedBraces++;
            else if (charCode === RBRACE) {
                this.#unbalancedBraces--;
                if (this.#unbalancedBraces === 0) {
                    this.#inJson = false;
                    return this.#textDecoder.decode(new Uint8Array(this.#rawText));
                }
            } else if (charCode === QUOT) this.#inString = true;
        }
        return null;
    }
}

const jsonStream = new JsonStream();
// ---- end JsonStream ----

let stdinChunks = [];
let currentStdinChunk = [];
const textEncoder = new TextEncoder();
let resolveStdinReady = () => {};

const stdin = () => {
    if (currentStdinChunk.length === 0) {
        if (stdinChunks.length === 0) {
            return null;
        }
        const nextChunk = stdinChunks.shift();
        currentStdinChunk.push(...textEncoder.encode(nextChunk), null);
    }
    return currentStdinChunk.shift();
};

const stdinReady = async () => {
    if (stdinChunks.length === 0) {
        return new Promise(resolve => {
            resolveStdinReady = resolve;
        });
    }
};

// stdout: 使用 JsonStream 状态机，O(n)，无冗余拷贝
const stdout = (charCode) => {
    const jsonOrNull = jsonStream.insert(charCode);
    if (jsonOrNull !== null) {
        try {
            const message = JSON.parse(jsonOrNull);
            self.postMessage({ type: 'lsp', message });
        } catch (e) {
            console.error('[clangd-monaco-worker] Failed to parse JSON:', e);
        }
    }
};

// stderr
const stderrBuffer = { buffer: '' };

const stderr = (charCode) => {
    const char = String.fromCharCode(charCode);
    if (char === '\n') {
        console.log('[clangd-monaco-worker] stderr:', stderrBuffer.buffer);
        stderrBuffer.buffer = '';
    } else {
        stderrBuffer.buffer += char;
    }
};

let clangdStarted = false;

const onAbort = (code) => {
    console.error('[clangd-monaco-worker] Aborted with code:', code);
    if (!clangdStarted) {
        self.postMessage({ type: 'error', code });
    }
};

let sendToClangd = null;

async function initClangd(wasmUrl) {
    console.log('[clangd-monaco-worker] Initializing clangd...');

    const Module = await ClangdModule({
        locateFile: (path) => path === 'clangd.wasm' ? wasmUrl : path,
        thisProgram: '/usr/bin/clangd',
        stdinReady,
        stdin,
        stdout,
        stderr,
        onExit: onAbort,
        onAbort,
        INITIAL_MEMORY: 2 * 1024 * 1024 * 1024,
        MAXIMUM_MEMORY: 4 * 1024 * 1024 * 1024,
        ALLOW_MEMORY_GROWTH: true,
    });

    const flags = [
        '--target=wasm32-wasi',
        '-isystem/usr/include/c++/v1',
        '-isystem/usr/include/wasm32-wasi/c++/v1',
        '-isystem/usr/include',
        '-isystem/usr/include/wasm32-wasi',
        '-xc++',
        '-std=c++14',
        '-pedantic-errors',
        '-Wall'
    ];

    try {
        Module.FS.createPath('/usr', 'include', true, true);
        Module.FS.createPath('/usr/include', 'bits', true, true);

        const stdcPlusPlusContent = `// bits/stdc++.h - Virtual header for clangd
#ifndef _GLIBCXX_BITS_STDCC_H
#define _GLIBCXX_BITS_STDCC_H

#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <map>
#include <set>
#include <queue>
#include <stack>
#include <deque>
#include <unordered_map>
#include <unordered_set>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <climits>
#include <cctype>
#include <cassert>
#include <iomanip>
#include <fstream>
#include <sstream>
#include <bitset>
#include <list>
#include <array>
#include <tuple>
#include <utility>
#include <memory>
#include <functional>
#include <iterator>
#include <stdexcept>
#include <exception>
#include <new>
#include <typeinfo>
#include <type_traits>
#include <chrono>
#include <random>
#include <regex>
#include <atomic>
#include <valarray>
#include <complex>
#include <numeric>
#include <initializer_list>
#include <cfenv>
#include <cfloat>
#include <cinttypes>
#include <clocale>
#include <cstdarg>
#include <cstddef>
#include <cstdint>
#include <cwchar>
#include <cwctype>

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <limits.h>
#include <ctype.h>
#include <math.h>
#include <float.h>
#include <stdarg.h>
#include <stddef.h>
#include <stdint.h>

#endif
`;
        Module.FS.writeFile('/usr/include/bits/stdc++.h', stdcPlusPlusContent);
        console.log('[clangd-monaco-worker] Created virtual bits/stdc++.h');
    } catch (e) {
        console.warn('[clangd-monaco-worker] Could not create bits/stdc++.h:', e);
    }

    Module.FS.writeFile('/home/web_user/.clangd', JSON.stringify({
        CompileFlags: { Add: flags }
    }));
    Module.FS.writeFile('/home/web_user/.clang-format', `BasedOnStyle: LLVM
IndentWidth: 4
UseTab: Never
`);
    Module.FS.writeFile('/home/web_user/main.cpp', '');

    console.log('[clangd-monaco-worker] Starting clangd server...');

    sendToClangd = (data) => {
        const body = JSON.stringify(data);
        const bodyBytes = textEncoder.encode(body);
        const header = `Content-Length: ${bodyBytes.length}\r\n`;
        const delimiter = '\r\n';
        stdinChunks.push(header, delimiter, body);
        resolveStdinReady();
    };

    Module.callMain([]);

    clangdStarted = true;
    console.log('[clangd-monaco-worker] Clangd started!');
    self.postMessage({ type: 'ready' });
}

self.onmessage = async (e) => {
    const { type, message, wasmUrl } = e.data;

    if (type === 'init') {
        try {
            await initClangd(wasmUrl);
        } catch (error) {
            console.error('[clangd-monaco-worker] Init failed:', error);
            self.postMessage({ type: 'error', error: error.message });
        }
        return;
    }

    if (type === 'lsp' && sendToClangd) {
        sendToClangd(message);
    }
};

console.log('[clangd-monaco-worker] Waiting for init message...');
