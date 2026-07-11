import Clang from "./clang.js";
import LLD from "./lld.js";
import { createWasi, WasiExitError, ReadableFd, WriteableFd, PreopenDirectory } from "./wasi-shim.js";

let systemInitialized = false;
let sysrootData = null;
let clangWasmUrl = null;
let lldWasmUrl = null;

self.onmessage = async (e) => {
    const msg = e.data;
    try {
        switch (msg.type) {
            case 'init':
                sysrootData = msg.sysroot;
                clangWasmUrl = msg.clangWasmUrl;
                lldWasmUrl = msg.lldWasmUrl;
                systemInitialized = true;
                self.postMessage({ type: 'ready' });
                break;

            case 'compile':
                if (!systemInitialized) {
                    self.postMessage({ type: 'compiled', id: msg.id, error: 'Compile system not initialized' });
                    break;
                }
                const compileResult = await doCompileOnly(msg.code, msg.flags || ['-O2', '-std=c++14', '-Wall']);
                if (compileResult.error) {
                    self.postMessage({ type: 'result', id: msg.id, Warnings: '', Errors: compileResult.error, Result: '', Stats: `Compile: ${compileResult.compileTime}s` });
                } else {
                    self.postMessage({ type: 'compiled', id: msg.id, wasmBinary: compileResult.wasmBinary, stderr: compileResult.stderr, compileTime: compileResult.compileTime, stdin: msg.stdin || '' });
                }
                break;

            case 'run':
                const runResult = await doRunOnly(msg.wasmBinary, msg.stdin || '', msg.stderr, parseFloat(msg.compileTime));
                self.postMessage({ type: 'result', id: msg.id, ...runResult });
                break;
        }
    } catch (err) {
        self.postMessage({
            type: 'result',
            id: msg?.id || 0,
            Errors: `Worker error: ${err.message}`,
            Result: '',
            Warnings: '',
            Stats: ''
        });
    }
};

function setUpSysroot(module, tar, extraFiles) {
    function* tarContents(contents) {
        const data = new Uint8Array(contents);
        let offset = 0;
        const textDecoder = new TextDecoder('utf-8');
        while (offset + 512 <= data.length) {
            const header = data.slice(offset, offset + 512);
            const name = textDecoder.decode(header.slice(0, 100)).replace(/\0.*$/, '');
            if (!name) break;
            const sizeOctal = textDecoder.decode(header.slice(124, 136)).replace(/\0.*$/, '').trim();
            const size = parseInt(sizeOctal, 8) || 0;
            const contentStart = offset + 512;
            const content = data.slice(contentStart, contentStart + size);
            yield { name, content };
            const totalSize = 512 + Math.ceil(size / 512) * 512;
            offset += totalSize;
        }
    }
    for (const { name, content } of tarContents(tar)) {
        if (name.endsWith('/')) continue;
        const dirName = name.split('/').slice(0, -1).join('/');
        if (!module.FS.analyzePath(dirName).exists) {
            module.FS.mkdirTree(dirName);
        }
        module.FS.writeFile(name, content);
    }
    if (extraFiles) {
        for (const [name, content] of Object.entries(extraFiles)) {
            const dirName = name.split('/').slice(0, -1).join('/');
            module.FS.mkdirTree(dirName);
            module.FS.writeFile(name, typeof content === 'string' ? content : new Uint8Array(content));
        }
    }
}

async function getCompilerInvocation(clang, inputName, inputFile, flags) {
    let stderr = '';
    const tempClang = await Clang({
        thisProgram: 'clang++',
        printErr: (data) => { stderr += data + '\n'; },
        locateFile: (path) => path === 'clang.wasm' ? clangWasmUrl : path,
    });
    tempClang.FS.writeFile(inputName, inputFile);
    tempClang.FS.mkdirTree('/lib/wasm32-wasi');
    tempClang.FS.mkdirTree('/include/c++/v1');
    tempClang.FS.writeFile('/lib/wasm32-wasi/crt1-command.o', new Uint8Array(0));
    tempClang.FS.writeFile('/lib/wasm32-wasi/crt1-reactor.o', new Uint8Array(0));
    const ret = tempClang.callMain([inputName, ...flags, '-###']);
    if (ret !== 0) throw new Error(`Clang driver failed: ${stderr}`);
    const lines = stderr.split('\n');
    const getArgs = (key) => {
        const line = lines.find(l => l.includes(key)) || '';
        const args = (line.match(/"([^"]*)"/g) || []).map(s => s.slice(1, -1)).slice(1);
        const oIndex = args.findIndex(a => a === '-o');
        return { args, outputFileName: oIndex >= 0 ? args[oIndex + 1] : '' };
    };
    const cc1 = getArgs('-cc1');
    const linker = getArgs('wasm-ld');
    return {
        compilerArgs: cc1.args,
        compilerArtifact: cc1.outputFileName,
        linkerArgs: linker.args,
        linerArtifact: linker.outputFileName,
    };
}

async function doCompileOnly(code, flags) {
    let stderr = '';
    const startTime = performance.now();

    const clang = await Clang({
        thisProgram: 'clang++',
        printErr: (data) => { stderr += data + '\n'; },
        locateFile: (path) => path === 'clang.wasm' ? clangWasmUrl : path,
    });

    setUpSysroot(clang, sysrootData);

    const fileName = 'main.cpp';
    clang.FS.writeFile(fileName, code);

    const invocation = await getCompilerInvocation(clang, fileName, code, flags);
    if (!invocation.compilerArgs || invocation.compilerArgs.length === 0) {
        return { error: 'Failed to get compiler invocation', compileTime: ((performance.now() - startTime) / 1000).toFixed(2) };
    }

    let exitCode = clang.callMain(invocation.compilerArgs);
    if (exitCode !== 0) {
        return { error: stderr || `Compilation failed with code ${exitCode}`, compileTime: ((performance.now() - startTime) / 1000).toFixed(2) };
    }

    const binary = clang.FS.readFile(invocation.compilerArtifact, { encoding: 'binary' });

    const lld = await LLD({
        thisProgram: 'wasm-ld',
        printErr: (data) => { stderr += data + '\n'; },
        locateFile: (path) => path === 'lld.wasm' ? lldWasmUrl : path,
    });

    setUpSysroot(lld, sysrootData);
    lld.FS.writeFile(invocation.compilerArtifact, binary);

    exitCode = lld.callMain(invocation.linkerArgs);
    if (exitCode !== 0) {
        return { error: stderr || `Linking failed with code ${exitCode}`, compileTime: ((performance.now() - startTime) / 1000).toFixed(2) };
    }

    const wasmBinary = lld.FS.readFile(invocation.linerArtifact, { encoding: 'binary' });
    const compileTime = ((performance.now() - startTime) / 1000).toFixed(2);

    return { wasmBinary, stderr, compileTime };
}

async function doRunOnly(wasmBinary, stdin, stderrFromCompile, compileTime) {
    let stderr = stderrFromCompile || '';
    const startTime = performance.now();

    const wasmModule = await WebAssembly.compile(wasmBinary);

    const inputFd = new ReadableFd(stdin);
    let capturedStdout = '';
    let capturedStderr = '';
    const outputFd = new WriteableFd((data) => { capturedStdout += new TextDecoder().decode(data); });
    const errorFd = new WriteableFd((data) => { capturedStderr += new TextDecoder().decode(data); });

    const preopens = {};
    preopens[3] = new PreopenDirectory('/');
    preopens[4] = new PreopenDirectory('/');

    let exitCode2 = 0;
    try {
        const memRef = { current: null };
        const wasi = createWasi(memRef, [], [], inputFd, outputFd, errorFd, preopens);

        const imports = WebAssembly.Module.imports(wasmModule);
        const neededModules = {};
        for (const imp of imports) {
            if (!neededModules[imp.module]) neededModules[imp.module] = {};
        }

        let externalMemory = null;
        if (imports.some(i => i.module === 'env' && i.name === 'memory')) {
            externalMemory = new WebAssembly.Memory({ initial: 256, maximum: 65536 });
            neededModules.env = neededModules.env || {};
            neededModules.env.memory = externalMemory;
        }

        neededModules.wasi_snapshot_preview1 = wasi.wasiImport;
        if (imports.some(i => i.module === 'wasi_unstable')) {
            neededModules.wasi_unstable = wasi.wasiImport;
        }

        const inst = new WebAssembly.Instance(wasmModule, neededModules);

        if (inst.exports.memory) {
            memRef.current = inst.exports.memory;
        } else if (externalMemory) {
            memRef.current = externalMemory;
        } else {
            const fallbackMem = new WebAssembly.Memory({ initial: 256 });
            memRef.current = fallbackMem;
        }

        if (typeof inst.exports._start === 'function') {
            inst.exports._start();
        } else if (typeof inst.exports.main === 'function') {
            exitCode2 = Number(inst.exports.main()) || 0;
        }
    } catch (e) {
        if (e instanceof WasiExitError) {
            exitCode2 = e.code;
        } else {
            capturedStderr += `Runtime error: ${e.message}\n`;
        }
    }

    const runTime = ((performance.now() - startTime) / 1000).toFixed(2);

    const warnings = stderr.includes('warning') ? stderr.split('\n').filter(l => l.includes('warning')).join('\n') : '';
    const errors = stderr.includes('error') ? stderr.split('\n').filter(l => l.includes('error') && !l.includes('warning')).join('\n') : '';

    return {
        Warnings: warnings,
        Errors: errors || (exitCode2 !== 0 && !capturedStdout ? capturedStderr : ''),
        Result: capturedStdout || '',
        Stats: `Compile: ${compileTime}s | Run: ${runTime}s | Total: ${(parseFloat(compileTime) + parseFloat(runTime)).toFixed(2)}s | Exit: ${exitCode2}`
    };
}
