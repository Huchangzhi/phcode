let dialogContainer: HTMLDivElement | null = null;
let currentResolve: ((value: any) => void) | null = null;
let currentReject: ((reason?: any) => void) | null = null;

function createDialogContainer(): HTMLDivElement {
    if (dialogContainer) return dialogContainer;
    dialogContainer = document.createElement('div');
    dialogContainer.id = 'phoi-dialog-overlay';
    dialogContainer.style.cssText = `
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(2px);
    `;
    document.body.appendChild(dialogContainer);
    return dialogContainer;
}

function createDialogContent(title: string, message: string, type: string, defaultValue = ''): HTMLDivElement {
    const dialog = document.createElement('div');
    dialog.id = 'phoi-dialog';
    dialog.style.cssText = `
        background-color: #252526;
        border: 1px solid #3e3e42;
        border-radius: 6px;
        padding: 20px;
        max-width: 400px;
        width: 85%;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    `;
    let html = `
        <div style="color: #cccccc; font-weight: bold; margin-bottom: 15px; font-size: 16px;">${title}</div>
        <div style="color: #cccccc; margin-bottom: 20px; line-height: 1.5;">${message}</div>
    `;
    if (type === 'prompt') {
        html += `
            <input id="phoi-dialog-input" type="text" value="${defaultValue}"
                style="width: 100%; padding: 8px; background-color: #3c3c3c; color: #cccccc; border: 1px solid #3e3e42; border-radius: 4px; margin-bottom: 15px; font-size: 14px;"
                placeholder="请输入...">
        `;
    }
    html += `<div style="display: flex; gap: 10px; justify-content: flex-end;">`;
    if (type === 'alert') {
        html += `<button id="phoi-dialog-ok"
            style="padding: 8px 20px; background-color: #0e639c; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 14px;">
            确定
        </button>`;
    } else if (type === 'confirm' || type === 'prompt') {
        html += `
            <button id="phoi-dialog-cancel"
                style="padding: 8px 20px; background-color: #3e3e42; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 14px;">
                取消
            </button>
            <button id="phoi-dialog-ok"
                style="padding: 8px 20px; background-color: #0e639c; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 14px;">
                确定
            </button>
        `;
    }
    html += `</div>`;
    dialog.innerHTML = html;
    return dialog;
}

function showDialog(title: string, message: string, type: string, defaultValue = ''): Promise<any> {
    return new Promise((resolve, reject) => {
        currentResolve = resolve;
        currentReject = reject;

        const overlay = createDialogContainer();
        const dialog = createDialogContent(title, message, type, defaultValue);

        overlay.innerHTML = '';
        overlay.appendChild(dialog);
        overlay.style.display = 'flex';

        const okBtn = document.getElementById('phoi-dialog-ok');
        const cancelBtn = document.getElementById('phoi-dialog-cancel');
        const input = document.getElementById('phoi-dialog-input') as HTMLInputElement | null;

        if (input && type === 'prompt') {
            input.focus();
            input.select();

            input.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                    handleOk();
                } else if (e.key === 'Escape') {
                    handleCancel();
                }
            });
        }

        if (okBtn) {
            okBtn.addEventListener('click', handleOk);
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', handleCancel);
        }

        overlay.addEventListener('click', (e: MouseEvent) => {
            if (e.target === overlay) {
                handleCancel();
            }
        });

        function handleOk() {
            hideDialog();
            if (type === 'prompt') {
                const inputValue = (document.getElementById('phoi-dialog-input') as HTMLInputElement)?.value || '';
                resolve(inputValue);
            } else {
                resolve(true);
            }
        }

        function handleCancel() {
            hideDialog();
            if (type === 'prompt' || type === 'confirm') {
                resolve(type === 'prompt' ? null : false);
            } else {
                resolve(false);
            }
        }
    });
}

function hideDialog(): void {
    if (dialogContainer) {
        dialogContainer.style.display = 'none';
    }
}

export const PhoiDialog = {
    alert(message: string, title = '提示'): Promise<any> {
        return showDialog(title, message, 'alert');
    },
    confirm(message: string, title = '确认'): Promise<any> {
        return showDialog(title, message, 'confirm');
    },
    prompt(message: string, defaultValue = '', title = '输入'): Promise<any> {
        return showDialog(title, message, 'prompt', defaultValue);
    }
};

if (typeof window !== 'undefined') {
    const originalAlert = window.alert;
    const originalConfirm = window.confirm;
    const originalPrompt = window.prompt;

    (window as any).PhoiDialog = PhoiDialog;
}
