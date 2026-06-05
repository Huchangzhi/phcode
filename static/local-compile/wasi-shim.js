export class WasiExitError extends Error {
    constructor(code) {
        super(`exit(${code})`);
        this.code = code;
    }
}

const ERRNO_SUCCESS = 0;
const ERRNO_BADF = 8;
const ERRNO_NOSYS = 52;
const ERRNO_NOTSUP = 58;
const FILETYPE_CHARACTER_DEVICE = 2;
const FILETYPE_DIRECTORY = 3;
const FILETYPE_REGULAR_FILE = 4;
const RIGHTS_FD_READ = 1n << 1n;
const RIGHTS_FD_WRITE = 1n << 5n;
const RIGHTS_FD_SEEK = 1n << 6n;
const CLOCKID_MONOTONIC = 1;
const CLOCKID_REALTIME = 0;
const EVENTTYPE_CLOCK = 0;

class Fd {
    fd_close() { return ERRNO_SUCCESS }
    fd_read(size) { return { ret: ERRNO_NOSYS, data: new Uint8Array(0) } }
    fd_write(data) { return { ret: ERRNO_NOSYS, nwritten: 0 } }
    fd_seek(offset, whence) { return { ret: ERRNO_NOTSUP, offset: 0n } }
    fd_fdstat_get() {
        return {
            ret: ERRNO_SUCCESS,
            fdstat: {
                fs_filetype: FILETYPE_CHARACTER_DEVICE,
                fs_flags: 0,
                fs_rights_base: RIGHTS_FD_READ | RIGHTS_FD_WRITE,
                fs_rights_inheriting: 0n
            }
        };
    }
    fd_prestat_get() { return { ret: ERRNO_BADF, prestat: null } }
    fd_readdir_single(cookie) { return { ret: ERRNO_NOTSUP, dirent: null } }
    path_open(dirflags, path, oflags, fs_rights_base, fs_rights_inheriting, fd_flags) {
        return { ret: ERRNO_NOSYS, fd_obj: null };
    }
    path_filestat_get(flags, path) { return { ret: ERRNO_NOSYS, filestat: null } }
    path_create_directory(path) { return ERRNO_NOSYS }
    path_remove_directory(path) { return ERRNO_NOSYS }
    path_unlink_file(path) { return ERRNO_NOSYS }
    path_readlink(path) { return { ret: ERRNO_NOTSUP, data: null } }
}

class ReadableFd extends Fd {
    constructor(input) {
        super();
        this.data = new TextEncoder().encode(input);
        this.pos = 0;
    }
    fd_read(size) {
        const available = this.data.length - this.pos;
        const toRead = Math.min(size, available);
        if (toRead <= 0) return { ret: ERRNO_SUCCESS, data: new Uint8Array(0) };
        const chunk = this.data.slice(this.pos, this.pos + toRead);
        this.pos += toRead;
        return { ret: ERRNO_SUCCESS, data: chunk };
    }
}

class WriteableFd extends Fd {
    constructor(callback) {
        super();
        this.callback = callback;
    }
    fd_write(data) {
        this.callback(data);
        return { ret: ERRNO_SUCCESS, nwritten: data.byteLength };
    }
}

class PreopenDirectory extends Fd {
    constructor(name, files) {
        super();
        this.name = name;
        this.files = files || {};
    }
    fd_prestat_get() {
        const pr_name = new TextEncoder().encode(this.name);
        return {
            ret: ERRNO_SUCCESS,
            prestat: { tag: 0, inner: { pr_name } }
        };
    }
    path_open(dirflags, path, oflags, fs_rights_base, fs_rights_inheriting, fd_flags) {
        if (path === '.' || path === '') {
            return { ret: ERRNO_SUCCESS, fd_obj: this };
        }
        const parts = path.replace(/\/+/g, '/').replace(/^\/|\/$/g, '').split('/');
        let current = this.files;
        for (let i = 0; i < parts.length; i++) {
            if (!current || typeof current === 'string') {
                return { ret: ERRNO_BADF, fd_obj: null };
            }
            if (i === parts.length - 1) {
                const content = current[parts[i]];
                if (content !== undefined) {
                    const data = typeof content === 'string' ? new TextEncoder().encode(content) : content;
                    const ino = BigInt(Math.abs(hashCode(parts[i])));
                    return {
                        ret: ERRNO_SUCCESS,
                        fd_obj: new FileFd(data, ino)
                    };
                }
                return { ret: ERRNO_BADF, fd_obj: null };
            }
            current = current[parts[i]];
            if (!current || typeof current === 'string') {
                return { ret: ERRNO_BADF, fd_obj: null };
            }
        }
        return { ret: ERRNO_BADF, fd_obj: null };
    }
    path_filestat_get(flags, path) {
        const parts = path.replace(/\/+/g, '/').replace(/^\/|\/$/g, '').split('/');
        let current = this.files;
        for (let i = 0; i < parts.length; i++) {
            if (!current || typeof current === 'string') return { ret: ERRNO_BADF, filestat: null };
            if (i === parts.length - 1) {
                const val = current[parts[i]];
                if (val !== undefined) {
                    const data = typeof val === 'string' ? new TextEncoder().encode(val) : val;
                    return {
                        ret: ERRNO_SUCCESS,
                        filestat: {
                            dev: 0n, ino: BigInt(Math.abs(hashCode(parts[i]))),
                            filetype: FILETYPE_REGULAR_FILE,
                            nlink: 1n, size: BigInt(data.length),
                            atim: 0n, mtim: 0n, ctim: 0n
                        }
                    };
                }
                return { ret: ERRNO_BADF, filestat: null };
            }
            current = current[parts[i]];
        }
        return { ret: ERRNO_BADF, filestat: null };
    }
    fd_readdir_single(cookie) {
        const names = Object.keys(this.files);
        const idx = Number(cookie);
        if (idx >= names.length) return { ret: ERRNO_SUCCESS, dirent: null };
        const name = names[idx];
        const nameBytes = new TextEncoder().encode(name);
        const val = this.files[name];
        const filetype = (typeof val === 'object' && !(val instanceof Uint8Array)) ? FILETYPE_DIRECTORY : FILETYPE_REGULAR_FILE;
        return {
            ret: ERRNO_SUCCESS,
            dirent: {
                d_next: BigInt(idx + 1),
                d_ino: BigInt(Math.abs(hashCode(name))),
                d_namlen: nameBytes.length,
                d_type: filetype,
                name: nameBytes
            }
        };
    }
}

class FileFd extends Fd {
    constructor(data, ino) {
        super();
        this.data = data;
        this.ino = ino;
        this.pos = 0;
    }
    fd_read(size) {
        const available = this.data.length - this.pos;
        if (available <= 0) return { ret: ERRNO_SUCCESS, data: new Uint8Array(0) };
        const chunk = this.data.slice(this.pos, this.pos + Math.min(size, available));
        this.pos += chunk.length;
        return { ret: ERRNO_SUCCESS, data: chunk };
    }
    fd_write(data) {
        const newData = new Uint8Array(this.data.length + data.length);
        newData.set(this.data);
        newData.set(data, this.data.length);
        this.data = newData;
        return { ret: ERRNO_SUCCESS, nwritten: data.byteLength };
    }
    fd_seek(offset, whence) {
        let newPos;
        if (whence === 0) newPos = Number(offset);
        else if (whence === 1) newPos = this.pos + Number(offset);
        else if (whence === 2) newPos = this.data.length + Number(offset);
        else return { ret: ERRNO_NOTSUP, offset: 0n };
        if (newPos < 0) newPos = 0;
        this.pos = newPos;
        return { ret: ERRNO_SUCCESS, offset: BigInt(newPos) };
    }
    fd_fdstat_get() {
        return {
            ret: ERRNO_SUCCESS, fdstat: {
                fs_filetype: FILETYPE_REGULAR_FILE, fs_flags: 0,
                fs_rights_base: RIGHTS_FD_READ | RIGHTS_FD_WRITE | RIGHTS_FD_SEEK,
                fs_rights_inheriting: 0n
            }
        };
    }
}

function hashCode(s) {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        hash = ((hash << 5) - hash) + c;
        hash |= 0;
    }
    return hash;
}

export { ReadableFd, WriteableFd, PreopenDirectory, Fd };

export function createWasi(memRef, args, env, stdin, stdout, stderr, preopens) {
    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder('utf-8', { fatal: false });

    function buf() { return memRef.current ? memRef.current.buffer : new ArrayBuffer(0); }

    const wasiImport = {
        args_sizes_get(argcPtr, argvBufSizePtr) {
            const view = new DataView(buf());
            view.setUint32(argcPtr, args.length, true);
            let size = 0;
            for (const a of args) size += textEncoder.encode(a).length + 1;
            view.setUint32(argvBufSizePtr, size, true);
            return ERRNO_SUCCESS;
        },
        args_get(argvPtr, argvBufPtr) {
            const buf8 = new Uint8Array(buf());
            let offset = argvBufPtr;
            for (let i = 0; i < args.length; i++) {
                const view = new DataView(buf());
                view.setUint32(argvPtr + i * 4, offset, true);
                const bytes = textEncoder.encode(args[i]);
                buf8.set(bytes, offset);
                buf8[offset + bytes.length] = 0;
                offset += bytes.length + 1;
            }
            return ERRNO_SUCCESS;
        },
        environ_sizes_get(countPtr, sizePtr) {
            const view = new DataView(buf());
            view.setUint32(countPtr, env.length, true);
            let size = 0;
            for (const e of env) size += textEncoder.encode(e).length + 1;
            view.setUint32(sizePtr, size, true);
            return ERRNO_SUCCESS;
        },
        environ_get(environPtr, environBufPtr) {
            const buf8 = new Uint8Array(buf());
            let offset = environBufPtr;
            for (let i = 0; i < env.length; i++) {
                const view = new DataView(buf());
                view.setUint32(environPtr + i * 4, offset, true);
                const bytes = textEncoder.encode(env[i]);
                buf8.set(bytes, offset);
                buf8[offset + bytes.length] = 0;
                offset += bytes.length + 1;
            }
            return ERRNO_SUCCESS;
        },
        clock_res_get(id, resPtr) {
            const view = new DataView(buf());
            if (id === CLOCKID_MONOTONIC) view.setBigUint64(resPtr, 5000n, true);
            else if (id === CLOCKID_REALTIME) view.setBigUint64(resPtr, 1000000n, true);
            else return ERRNO_NOSYS;
            return ERRNO_SUCCESS;
        },
        clock_time_get(id, precision, timePtr) {
            const view = new DataView(buf());
            if (id === CLOCKID_REALTIME) {
                view.setBigUint64(timePtr, BigInt(Date.now()) * 1000000n, true);
            } else {
                try {
                    view.setBigUint64(timePtr, BigInt(Math.round(performance.now() * 1e6)), true);
                } catch {
                    view.setBigUint64(timePtr, 0n, true);
                }
            }
            return ERRNO_SUCCESS;
        },
        fd_close(fd) {
            return ERRNO_SUCCESS;
        },
        fd_fdstat_get(fd, statPtr) {
            let result;
            if (fd === 0) result = stdin.fd_fdstat_get();
            else if (fd === 1) result = stdout.fd_fdstat_get();
            else if (fd === 2) result = stderr.fd_fdstat_get();
            else if (preopens[fd]) return preopens[fd].fd_fdstat_get();
            else return ERRNO_BADF;

            if (result.ret === ERRNO_SUCCESS && result.fdstat) {
                const dv = new DataView(buf());
                const s = result.fdstat;
                dv.setUint8(statPtr + 0, s.fs_filetype);
                dv.setUint16(statPtr + 2, s.fs_flags, true);
                dv.setBigUint64(statPtr + 8, s.fs_rights_base, true);
                dv.setBigUint64(statPtr + 16, s.fs_rights_inheriting, true);
            }
            return result.ret;
        },
        fd_prestat_get(fd, bufPtr) {
            const preopen = preopens[fd];
            if (!preopen) return ERRNO_BADF;
            const result = preopen.fd_prestat_get();
            if (result.ret === ERRNO_SUCCESS && result.prestat) {
                const dv = new DataView(buf());
                dv.setUint8(bufPtr, result.prestat.tag);
                dv.setUint32(bufPtr + 4, result.prestat.inner.pr_name.length, true);
            }
            return result.ret;
        },
        fd_prestat_dir_name(fd, pathPtr, pathLen) {
            const preopen = preopens[fd];
            if (!preopen) return ERRNO_BADF;
            const nameBytes = new TextEncoder().encode(preopen.name);
            const buf8 = new Uint8Array(buf());
            buf8.set(nameBytes.slice(0, pathLen), pathPtr);
            return ERRNO_SUCCESS;
        },
        fd_read(fd, iovsPtr, iovsLen, nreadPtr) {
            const view = new DataView(buf());
            const buf8 = new Uint8Array(buf());
            let totalRead = 0;
            for (let i = 0; i < iovsLen; i++) {
                const bufPtr = view.getUint32(iovsPtr + i * 8, true);
                const bufLen = view.getUint32(iovsPtr + i * 8 + 4, true);
                let result;
                if (fd === 0) result = stdin.fd_read(bufLen);
                else if (preopens[fd]) result = preopens[fd].fd_read(bufLen);
                else return ERRNO_BADF;
                if (result.ret !== ERRNO_SUCCESS) return result.ret;
                if (result.data.length > 0) buf8.set(result.data, bufPtr);
                totalRead += result.data.length;
                if (result.data.length < bufLen) break;
            }
            view.setUint32(nreadPtr, totalRead, true);
            return ERRNO_SUCCESS;
        },
        fd_write(fd, iovsPtr, iovsLen, nwrittenPtr) {
            const view = new DataView(buf());
            const buf8 = new Uint8Array(buf());
            let totalWritten = 0;
            for (let i = 0; i < iovsLen; i++) {
                const bufPtr = view.getUint32(iovsPtr + i * 8, true);
                const bufLen = view.getUint32(iovsPtr + i * 8 + 4, true);
                const data = buf8.slice(bufPtr, bufPtr + bufLen);
                let result;
                if (fd === 1) result = stdout.fd_write(data);
                else if (fd === 2) result = stderr.fd_write(data);
                else if (preopens[fd]) result = preopens[fd].fd_write(data);
                else return ERRNO_BADF;
                if (result.ret !== ERRNO_SUCCESS) return result.ret;
                totalWritten += result.nwritten;
                if (result.nwritten < data.length) break;
            }
            view.setUint32(nwrittenPtr, totalWritten, true);
            return ERRNO_SUCCESS;
        },
        fd_seek(fd, offset, whence, newoffPtr) {
            const view = new DataView(buf());
            let result;
            if (preopens[fd]) result = preopens[fd].fd_seek(offset, whence);
            else return ERRNO_BADF;
            if (result.ret === ERRNO_SUCCESS) {
                view.setBigInt64(newoffPtr, result.offset, true);
            }
            return result.ret;
        },
        fd_readdir(fd, bufPtr, bufLen, cookie, bufusedPtr) {
            const preopen = preopens[fd];
            if (!preopen) return ERRNO_BADF;
            const view = new DataView(buf());
            const buf8 = new Uint8Array(buf());
            let bufused = 0;
            while (true) {
                const result = preopen.fd_readdir_single(cookie);
                if (result.ret !== ERRNO_SUCCESS) return result.ret;
                if (!result.dirent) break;
                const d = result.dirent;
                const headLen = 24;
                if (bufused + headLen > bufLen) { bufused = bufLen; break; }
                let off = bufPtr + bufused;
                view.setBigUint64(off, d.d_next, true); off += 8;
                view.setBigUint64(off, d.d_ino, true); off += 8;
                view.setUint32(off, d.d_namlen, true); off += 4;
                view.setUint8(off, d.d_type); off += 1;
                bufused += headLen;
                const nameLen = Math.min(d.d_namlen, bufLen - bufused);
                buf8.set(d.name.slice(0, nameLen), bufPtr + bufused);
                bufused += nameLen;
                cookie = d.d_next;
            }
            view.setUint32(bufusedPtr, bufused, true);
            return ERRNO_SUCCESS;
        },
        fd_renumber(from, to) {
            return ERRNO_SUCCESS;
        },
        fd_sync(fd) { return ERRNO_SUCCESS },
        fd_advise(fd, offset, len, advice) { return ERRNO_SUCCESS },
        fd_allocate(fd, offset, len) { return ERRNO_SUCCESS },
        fd_filestat_get(fd, statPtr) {
            let result;
            if (fd === 0) result = stdin.fd_fdstat_get();
            else if (fd === 1 || fd === 2) {
                const view = new DataView(buf());
                view.setBigUint64(statPtr + 0, 0n, true);
                view.setBigUint64(statPtr + 8, BigInt(fd), true);
                view.setUint8(statPtr + 16, FILETYPE_CHARACTER_DEVICE);
                view.setBigUint64(statPtr + 24, 1n, true);
                view.setBigUint64(statPtr + 32, 0n, true);
                view.setBigUint64(statPtr + 40, BigInt(Date.now() * 1e6), true);
                view.setBigUint64(statPtr + 48, BigInt(Date.now() * 1e6), true);
                view.setBigUint64(statPtr + 56, BigInt(Date.now() * 1e6), true);
                return ERRNO_SUCCESS;
            }
            else if (preopens[fd]) result = preopens[fd].fd_fdstat_get();
            else return ERRNO_BADF;
            return result.ret;
        },
        path_open(fd, dirflags, pathPtr, pathLen, oflags, fsRightsBase, fsRightsInheriting, fdFlags, openedFdPtr) {
            const preopen = preopens[fd];
            if (!preopen) return ERRNO_BADF;
            const path = textDecoder.decode(new Uint8Array(buf()).slice(pathPtr, pathPtr + pathLen));
            const result = preopen.path_open(dirflags, path, oflags, fsRightsBase, fsRightsInheriting, fdFlags);
            if (result.ret === ERRNO_SUCCESS && result.fd_obj) {
                const newFd = nextFd++;
                preopens[newFd] = result.fd_obj;
                const view = new DataView(buf());
                view.setUint32(openedFdPtr, newFd, true);
            }
            return result.ret;
        },
        path_filestat_get(fd, flags, pathPtr, pathLen, statPtr) {
            const preopen = preopens[fd];
            if (!preopen) return ERRNO_BADF;
            const path = textDecoder.decode(new Uint8Array(buf()).slice(pathPtr, pathPtr + pathLen));
            const result = preopen.path_filestat_get(flags, path);
            if (result.ret === ERRNO_SUCCESS && result.filestat) {
                const view = new DataView(buf());
                const s = result.filestat;
                view.setBigUint64(statPtr + 0, s.dev, true);
                view.setBigUint64(statPtr + 8, s.ino, true);
                view.setUint8(statPtr + 16, s.filetype);
                view.setBigUint64(statPtr + 24, s.nlink, true);
                view.setBigUint64(statPtr + 32, s.size, true);
                view.setBigUint64(statPtr + 40, s.atim, true);
                view.setBigUint64(statPtr + 48, s.mtim, true);
                view.setBigUint64(statPtr + 56, s.ctim, true);
            }
            return result.ret;
        },
        path_filestat_set_times(fd, flags, pathPtr, pathLen, atim, mtim, fstFlags) {
            return ERRNO_SUCCESS;
        },
        path_create_directory(fd, pathPtr, pathLen) {
            const preopen = preopens[fd];
            if (!preopen) return ERRNO_BADF;
            const path = textDecoder.decode(new Uint8Array(buf()).slice(pathPtr, pathPtr + pathLen));
            return preopen.path_create_directory(path);
        },
        path_remove_directory(fd, pathPtr, pathLen) {
            const preopen = preopens[fd];
            if (!preopen) return ERRNO_BADF;
            const path = textDecoder.decode(new Uint8Array(buf()).slice(pathPtr, pathPtr + pathLen));
            return preopen.path_remove_directory(path);
        },
        path_unlink_file(fd, pathPtr, pathLen) {
            const preopen = preopens[fd];
            if (!preopen) return ERRNO_BADF;
            const path = textDecoder.decode(new Uint8Array(buf()).slice(pathPtr, pathPtr + pathLen));
            return preopen.path_unlink_file(path);
        },
        path_readlink(fd, pathPtr, pathLen, bufPtr, bufLen, nreadPtr) {
            const preopen = preopens[fd];
            if (!preopen) return ERRNO_BADF;
            const path = textDecoder.decode(new Uint8Array(buf()).slice(pathPtr, pathPtr + pathLen));
            const result = preopen.path_readlink(path);
            if (result.ret === ERRNO_SUCCESS && result.data) {
                const nameBytes = new TextEncoder().encode(result.data);
                const buf8 = new Uint8Array(buf());
                const toWrite = Math.min(nameBytes.length, bufLen);
                buf8.set(nameBytes.slice(0, toWrite), bufPtr);
                const view = new DataView(buf());
                view.setUint32(nreadPtr, toWrite, true);
            }
            return result.ret;
        },
        path_rename(fd, oldPathPtr, oldPathLen, newFd, newPathPtr, newPathLen) {
            return ERRNO_SUCCESS;
        },
        path_symlink(oldPathPtr, oldPathLen, fd, newPathPtr, newPathLen) {
            return ERRNO_NOTSUP;
        },
        poll_oneoff(inPtr, outPtr, nsubscriptions) {
            if (nsubscriptions === 0) return ERRNO_NOSYS;
            const view = new DataView(buf());
            const eventtype = view.getUint8(inPtr + 8);
            const clockid = view.getUint32(inPtr + 16, true);
            const timeout = view.getBigUint64(inPtr + 24, true);
            const userdata = view.getBigUint64(inPtr + 0, true);
            const flags = view.getUint16(inPtr + 44, true);
            if (eventtype !== EVENTTYPE_CLOCK) return ERRNO_NOTSUP;
            const getNow = clockid === CLOCKID_MONOTONIC
                ? () => BigInt(Math.round(performance.now() * 1e6))
                : () => BigInt(Date.now()) * 1000000n;
            const endTime = (flags & 1) ? timeout : getNow() + timeout;
            while (endTime > getNow()) { }
            const evOut = new DataView(buf());
            evOut.setBigUint64(outPtr + 0, userdata, true);
            evOut.setUint16(outPtr + 8, ERRNO_SUCCESS, true);
            evOut.setUint8(outPtr + 10, eventtype);
            return ERRNO_SUCCESS;
        },
        proc_exit(code) {
            throw new WasiExitError(code >>> 0);
        },
        sched_yield() { },
        random_get(bufPtr, bufLen) {
            const buf8 = new Uint8Array(buf(), bufPtr, bufLen);
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                for (let i = 0; i < bufLen; i += 65536) {
                    crypto.getRandomValues(buf8.subarray(i, Math.min(i + 65536, bufLen)));
                }
            } else {
                for (let i = 0; i < bufLen; i++) buf8[i] = (Math.random() * 256) | 0;
            }
            return ERRNO_SUCCESS;
        },
        sock_recv(fd, riData, riFlags) { return ERRNO_NOSYS },
        sock_send(fd, siData, siFlags) { return ERRNO_NOSYS },
        sock_shutdown(fd, how) { return ERRNO_NOSYS },
        sock_accept(fd, flags) { return ERRNO_NOSYS },
    };

    let nextFd = 3;
    const baseFds = { 0: stdin, 1: stdout, 2: stderr };
    const allFds = { ...baseFds, ...preopens };

    return { wasiImport };
}


