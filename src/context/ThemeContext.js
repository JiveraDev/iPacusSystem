import { createContext } from 'react';

import { THEME_OPTIONS } from '../lib/theme';

export const ThemeContext = createContext({
    theme: THEME_OPTIONS.LIGHT,
    isDark: false,
    setTheme: () => {},
    toggleTheme: () => {},
});
