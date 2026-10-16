import { createContext } from 'react';

import { getTheme, THEME_OPTIONS } from '../lib/theme';

export const ThemeContext = createContext({
    theme: THEME_OPTIONS.LIGHT,
    palette: getTheme(THEME_OPTIONS.LIGHT),
    isDark: false,
    setTheme: () => {},
    toggleTheme: () => {},
});
