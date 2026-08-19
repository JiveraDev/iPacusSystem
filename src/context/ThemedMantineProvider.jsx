import { createTheme, MantineProvider } from '@mantine/core';

import { useTheme } from '../hooks/useTheme.js';

const mantineTheme = createTheme({
    primaryColor: 'blue',
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
});

export default function ThemedMantineProvider({ children }) {
    const { isDark } = useTheme();

    return (
        <MantineProvider theme={mantineTheme} forceColorScheme={isDark ? 'dark' : 'light'}>
            {children}
        </MantineProvider>
    );
}
