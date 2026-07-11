const THEME_KEY = 'phoi_color_theme';

let systemThemeMediaQuery: MediaQueryList | null = null;
let systemThemeHandler: ((e: MediaQueryListEvent) => void) | null = null;

export function getActualTheme(): string {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    if (savedTheme === 'auto') {
        return getSystemPreferredTheme();
    }
    return savedTheme;
}

export function initTheme(): void {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    if (savedTheme === 'auto') {
        setupSystemThemeListener();
    }
    const actualTheme = getActualTheme();
    document.documentElement.setAttribute('data-theme', actualTheme);
    updateMonacoEditorTheme(actualTheme);
    updateImagesForTheme(actualTheme);
}

export function applyTheme(theme: string): void {
    localStorage.setItem(THEME_KEY, theme);
    if (theme === 'auto') {
        setupSystemThemeListener();
        const actualTheme = getSystemPreferredTheme();
        document.documentElement.setAttribute('data-theme', actualTheme);
        updateMonacoEditorTheme(actualTheme);
        updateImagesForTheme(actualTheme);
    } else {
        removeSystemThemeListener();
        document.documentElement.setAttribute('data-theme', theme);
        updateMonacoEditorTheme(theme);
        updateImagesForTheme(theme);
    }
}

export function getSystemPreferredTheme(): string {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
    }
    return 'dark';
}

export function applySystemTheme(): void {
    const systemTheme = getSystemPreferredTheme();
    document.documentElement.setAttribute('data-theme', systemTheme);
    updateMonacoEditorTheme(systemTheme);
    updateImagesForTheme(systemTheme);
}

export function setupSystemThemeListener(): void {
    if (window.matchMedia) {
        systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: light)');
        systemThemeHandler = (e: MediaQueryListEvent) => {
            const currentTheme = localStorage.getItem(THEME_KEY);
            if (currentTheme === 'auto') {
                applySystemTheme();
            }
        };
        if (systemThemeMediaQuery.addEventListener) {
            systemThemeMediaQuery.addEventListener('change', systemThemeHandler);
        }
    }
}

export function removeSystemThemeListener(): void {
    if (systemThemeMediaQuery && systemThemeHandler) {
        if (systemThemeMediaQuery.removeEventListener) {
            systemThemeMediaQuery.removeEventListener('change', systemThemeHandler);
        }
    }
}

export function updateMonacoEditorTheme(theme: string): void {
    const monaco = (window as any).monaco;
    if (monaco && monaco.editor) {
        const monacoTheme = theme === 'light' ? 'vs' : 'vs-dark';
        monaco.editor.setTheme(monacoTheme);
    }
}

export function updateMonacoTheme(theme: string): void {
    updateMonacoEditorTheme(theme);
}

export function updateImagesForTheme(theme: string): void {
    const logo = document.getElementById('logo');
    if (logo) {
        logo.setAttribute('src', theme === 'light' ? '/static/logo_light.png' : '/static/logo.png');
    }

    const buttonImageMap: Record<string, { dark: string; light: string }> = {
        'run-btn': { dark: '/static/run.png', light: '/static/run_light.png' },
        'sidebar-toggle': { dark: '/static/file.png', light: '/static/file_light.png' },
        'plugin-center-toggle': { dark: '/static/ext.png', light: '/static/ext_light.png' },
        'cph-plugin-toggle': { dark: '/static/cph.png', light: '/static/cph_light.png' },
        'debug-btn': { dark: '/static/debug.png', light: '/static/debug_light.png' }
    };

    for (const [id, mapping] of Object.entries(buttonImageMap)) {
        const button = document.getElementById(id);
        if (button) {
            const img = button.querySelector('img');
            if (img) {
                const newSrc = theme === 'light' ? mapping.light : mapping.dark;
                const testImg = new Image();
                testImg.onload = () => { img.src = newSrc; };
                testImg.onerror = () => {};
                testImg.src = newSrc;
            }
        }
    }
}

export function setTheme(theme: string): void {
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
}
