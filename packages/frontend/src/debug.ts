// Lazily access debug.js globals (debug.js IIFE sets them after ES modules evaluate)
const DM = () => (window as any).DebugModule
const DS = () => (window as any).debugState
const RFD = () => (window as any).refreshVariablesDisplay
const RAF = () => (window as any).refreshAllVariables
const RVS = () => (window as any).resetVariableState

let _initialized = false

function init(): void {
    if (_initialized) return
    _initialized = true
    const dm = DM()
    if (dm && typeof dm.init === 'function') dm.init()
}

function startDebug(pairingCode?: string): void {
    const dm = DM()
    if (dm && typeof dm.startDebug === 'function') {
        dm.startDebug(pairingCode)
    }
}

function stopDebug(): void {
    const dm = DM()
    if (dm && typeof dm.stopDebug === 'function') dm.stopDebug()
}

function sendCommand(cmd: string): void {
    const dm = DM()
    if (dm && typeof dm.sendCommand === 'function') dm.sendCommand(cmd)
}

function recreateBreakpointDecorations(): void {
    const dm = DM()
    if (dm && typeof dm.recreateBreakpointDecorations === 'function') dm.recreateBreakpointDecorations()
}

const ds = DS()
const debugState = ds || { isDebugging: false, pairingCode: null, eventSource: null, isMinimized: false, isPanelVisible: false }

function refreshVariablesDisplay(): void {
    const fn = RFD()
    if (typeof fn === 'function') fn()
}

function refreshAllVariables(): void {
    const fn = RAF()
    if (typeof fn === 'function') fn()
}

function resetVariableState(): void {
    const fn = RVS()
    if (typeof fn === 'function') fn()
}

export { init, startDebug, stopDebug, sendCommand, recreateBreakpointDecorations, debugState, refreshVariablesDisplay, refreshAllVariables, resetVariableState }
