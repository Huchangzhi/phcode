window.LocalCompile = (function () {
    let worker = null;
    let initialized = false;
    let initPromise = null;
    let pendingRequests = new Map();
    let requestId = 0;
    let readyCallbacks = [];
    let cachedClang = null;
    let cachedLld = null;
    let cachedSysroot = null;
    let terminateTimer = null;
    let initShown = false;

    function isAvailable() {
        return typeof WebAssembly !== 'undefined' && typeof Worker !== 'undefined';
    }

    function onReady(cb) {
        if (initialized) { cb(); return; }
        readyCallbacks.push(cb);
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(2) + ' MB';
    }

    function updateProgress(status, progress, max, detail) {
        if (initShown) return;
        if (typeof window.updateClangdDownloadProgress === 'function') {
            window.updateClangdDownloadProgress(status, progress, max, detail);
        }
    }

    function shouldTerminate() {
        return localStorage.getItem('phoi_local_compile_terminate') !== 'false';
    }

    function cancelTerminate() {
        if (terminateTimer) {
            clearTimeout(terminateTimer);
            terminateTimer = null;
        }
    }

    function terminateWorker() {
        cancelTerminate();
        if (worker) {
            worker.terminate();
            worker = null;
        }
        initialized = false;
        initPromise = null;
    }

    async function init() {
        if (initPromise) return initPromise;
        if (!isAvailable()) {
            initPromise = Promise.reject(new Error('SharedArrayBuffer not available. Need crossOriginIsolated.'));
            return initPromise;
        }

        initPromise = (async function () {
            if (!cachedClang || !cachedLld || !cachedSysroot) {
                updateProgress('lc_init', 0, 0, '准备下载编译器文件...');

                const [clangData, lldData, sysrootData] = await Promise.all([
                    downloadAndDecompress('/static/local-compile/clang.wasm.compressed', 'dl_clang', 'de_clang', 'Clang'),
                    downloadAndDecompress('/static/local-compile/lld.wasm.compressed', 'dl_lld', 'de_lld', 'LLD'),
                    downloadAndDecompress('/static/local-compile/sysroot.tar.compressed', 'dl_sysroot', 'de_sysroot', 'Sysroot'),
                ]);
                cachedClang = clangData;
                cachedLld = lldData;
                cachedSysroot = sysrootData;
            } else {
                updateProgress('lc_init', 0, 0, '使用缓存文件...');
            }

            updateProgress('lc_init', 80, 100, '启动编译器...');

            const clangBlob = new Blob([cachedClang], { type: 'application/wasm' });
            const clangWasmUrl = URL.createObjectURL(clangBlob);
            const lldBlob = new Blob([cachedLld], { type: 'application/wasm' });
            const lldWasmUrl = URL.createObjectURL(lldBlob);

            worker = new Worker('/static/local-compile/compile-worker.js', { type: 'module' });

            worker.onmessage = function (e) {
                const msg = e.data;
                if (msg.type === 'ready') {
                    initialized = true;
                    updateProgress('lc_ready', 100, 100, '点击 × 关闭');
                    initShown = true;
                    readyCallbacks.forEach(cb => cb());
                    readyCallbacks = [];
                    return;
                }
                if (msg.type === 'compiled') {
                    const resolve = pendingRequests.get(msg.id);
                    if (!resolve) return;
                    if (msg.error || !msg.wasmBinary) {
                        pendingRequests.delete(msg.id);
                        resolve({ Warnings: '', Errors: msg.error || 'Compile failed', Result: '', Stats: `Compile: ${msg.compileTime || '?'}s` });
                        return;
                    }
                    // Compile done, now run with 5s timeout
                    const runTimeout = setTimeout(() => {
                        pendingRequests.delete(msg.id);
                        terminateWorker();
                        resolve({ Warnings: '', Errors: '运行超时（超过10秒），已终止', Result: '', Stats: '' });
                    }, 10000);
                    pendingRequests.set(msg.id, (result) => {
                        clearTimeout(runTimeout);
                        if (shouldTerminate()) {
                            terminateTimer = setTimeout(() => terminateWorker(), 500);
                        }
                        resolve(result);
                    });
                    worker.postMessage({
                        type: 'run',
                        id: msg.id,
                        wasmBinary: msg.wasmBinary,
                        stdin: msg.stdin,
                        stderr: msg.stderr,
                        compileTime: msg.compileTime,
                    }, [msg.wasmBinary.buffer]);
                    return;
                }
                if (msg.type === 'result') {
                    const resolve = pendingRequests.get(msg.id);
                    if (resolve) {
                        pendingRequests.delete(msg.id);
                        resolve(msg);
                    }
                }
            };

            worker.onerror = function (err) {
                console.error('[LocalCompile] Worker error:', err);
                initialized = false;
            };

            const sysrootCopy = cachedSysroot.slice(0);
            worker.postMessage({
                type: 'init',
                clangWasmUrl,
                lldWasmUrl,
                sysroot: sysrootCopy,
            }, [sysrootCopy.buffer]);
        })();

        return initPromise;
    }

    async function downloadAndDecompress(url, dlStatus, deStatus, label) {
        updateProgress(dlStatus, 0, 100, `开始下载 ${label}...`);

        const response = await fetch(url);
        if (!response.ok) throw new Error(`下载${label}失败: ${response.status}`);

        const totalSize = parseInt(response.headers.get('content-length') || '0');
        const reader = response.body.getReader();
        const chunks = [];
        let loaded = 0;
        let lastPct = -1;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            if (totalSize) {
                const pct = Math.round(loaded / totalSize * 100);
                if (pct !== lastPct) {
                    lastPct = pct;
                    updateProgress(dlStatus, pct, 100, `下载中 ${formatSize(loaded)} / ${formatSize(totalSize)}`);
                }
            } else {
                updateProgress(dlStatus, 0, 0, `已下载 ${formatSize(loaded)}`);
            }
        }

        const gzData = new Uint8Array(loaded);
        let offset = 0;
        for (const chunk of chunks) {
            gzData.set(chunk, offset);
            offset += chunk.length;
        }

        updateProgress(deStatus, 50, 100, `正在解压 ${label}...`);
        let decompressed;
        if (typeof window.pako !== 'undefined') {
            decompressed = window.pako.inflate(gzData);
            if (decompressed instanceof Promise) decompressed = await decompressed;
        } else if (typeof DecompressionStream !== 'undefined') {
            decompressed = new Uint8Array(
                await new Response(
                    new Blob([gzData]).stream().pipeThrough(new DecompressionStream('gzip'))
                ).arrayBuffer()
            );
        } else {
            throw new Error('No decompression method available');
        }

        updateProgress(deStatus, 100, 100, `${label} 完成 (${formatSize(decompressed.length)})`);
        return decompressed;
    }

    async function compileAndRun(code, stdin) {
        if (!worker) {
            try {
                await init();
            } catch (e) {
                updateProgress('failed', 0, 100, e.message);
                return {
                    Warnings: '',
                    Errors: `本地编译初始化失败: ${e.message}`,
                    Result: '',
                    Stats: ''
                };
            }
        }

        updateProgress('lc_compile', 0, 0, '正在执行编译...');

        cancelTerminate();

        return new Promise((resolve) => {
            const id = ++requestId;

            pendingRequests.set(id, (result) => {
                updateProgress('lc_complete', 100, 100, '运行完成');
                if (shouldTerminate()) {
                    terminateTimer = setTimeout(() => terminateWorker(), 500);
                }
                resolve(result);
            });
            worker.postMessage({
                type: 'compile',
                id,
                code,
                stdin: stdin || '',
                flags: ['-O2', '-std=c++14', '-Wall', '-fno-exceptions']
            });
        });
    }

    return {
        init,
        isAvailable,
        onReady,
        compileAndRun,
        get initialized() { return initialized; }
    };
})();
