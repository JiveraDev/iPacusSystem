import { useCallback, useEffect, useMemo, useState } from 'react';

import { ThemeContext } from './ThemeContext';
import { getStoredTheme, normalizeTheme, THEME_OPTIONS, THEME_STORAGE_KEY } from '../lib/theme';

export default function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState(getStoredTheme);

    useEffect(() => {
        const normalizedTheme = normalizeTheme(theme);
        const root = document.documentElement;

        root.classList.toggle('dark', normalizedTheme === THEME_OPTIONS.DARK);
        root.dataset.theme = normalizedTheme;
        root.style.colorScheme = normalizedTheme;
        localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
    }, [theme]);

    const setTheme = useCallback((nextTheme) => {
        setThemeState(normalizeTheme(nextTheme));
    }, []);

    const toggleTheme = useCallback(() => {
        setThemeState((currentTheme) => (
            currentTheme === THEME_OPTIONS.DARK ? THEME_OPTIONS.LIGHT : THEME_OPTIONS.DARK
        ));
    }, []);

    const contextValue = useMemo(() => ({
        theme,
        isDark: theme === THEME_OPTIONS.DARK,
        setTheme,
        toggleTheme,
    }), [setTheme, theme, toggleTheme]);

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
}
