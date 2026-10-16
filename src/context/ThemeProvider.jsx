import { useCallback, useEffect, useMemo, useState } from 'react';

import { ThemeContext } from './ThemeContext';
import { applyTheme, getStoredTheme, getTheme, normalizeTheme, THEME_STORAGE_KEY } from '../lib/theme';

export default function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState(getStoredTheme);

    useEffect(() => {
        const palette = applyTheme(theme);
        try {
            localStorage.setItem(THEME_STORAGE_KEY, palette.id);
        } catch {
            // The selected palette still works when browser storage is blocked.
        }
    }, [theme]);

    const setTheme = useCallback((nextTheme) => {
        setThemeState(normalizeTheme(nextTheme));
    }, []);

    const toggleTheme = useCallback(() => {
        setThemeState((currentTheme) => getTheme(currentTheme).pairedTheme);
    }, []);

    const contextValue = useMemo(() => ({
        theme,
        palette: getTheme(theme),
        isDark: getTheme(theme).appearance === 'dark',
        setTheme,
        toggleTheme,
    }), [setTheme, theme, toggleTheme]);

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
}
