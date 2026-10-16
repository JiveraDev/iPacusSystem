import { createTheme, MantineProvider } from '@mantine/core';

import { useTheme } from '../hooks/useTheme.js';

const mantineTheme = createTheme({
    primaryColor: 'blue',
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
});

function paletteVariables() {
    const semanticColors = {
        '--mantine-color-text': 'var(--theme-text)',
        '--mantine-color-body': 'var(--theme-surface)',
        '--mantine-color-dimmed': 'var(--theme-text-soft)',
        '--mantine-color-placeholder': 'var(--theme-text-soft)',
        '--mantine-color-default': 'var(--theme-input)',
        '--mantine-color-default-hover': 'var(--theme-surface-soft)',
        '--mantine-color-default-color': 'var(--theme-text)',
        '--mantine-color-default-border': 'var(--theme-border-strong)',
        '--mantine-color-disabled': 'var(--theme-surface-soft)',
        '--mantine-color-disabled-color': 'var(--theme-text-soft)',
        '--mantine-color-disabled-border': 'var(--theme-border)',
    };
    return {
        variables: {
            '--mantine-primary-color-filled': 'var(--theme-primary)',
            '--mantine-primary-color-filled-hover': 'var(--theme-primary-hover)',
            '--mantine-primary-color-contrast': 'var(--theme-on-primary)',
        },
        light: semanticColors,
        dark: semanticColors,
    };
}

export default function ThemedMantineProvider({ children }) {
    const { isDark, theme } = useTheme();

    return (
        <MantineProvider theme={mantineTheme} forceColorScheme={isDark ? 'dark' : 'light'} cssVariablesResolver={theme === 'light' ? undefined : paletteVariables}>
            {children}
        </MantineProvider>
    );
}
