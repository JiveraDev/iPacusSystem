export const THEME_STORAGE_KEY = 'ipawcus-theme';
export const THEME_OPTIONS = {
    LIGHT: 'light',
    DARK: 'dark',
};

export function normalizeTheme(value) {
    return value === THEME_OPTIONS.DARK ? THEME_OPTIONS.DARK : THEME_OPTIONS.LIGHT;
}

export function getStoredTheme() {
    if (typeof window === 'undefined') {
        return THEME_OPTIONS.LIGHT;
    }

    return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
}
