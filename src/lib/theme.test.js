import assert from 'node:assert/strict';
import test from 'node:test';

import { applyTheme, contrastRatio, getStoredTheme, getTheme, normalizeTheme, THEME_CATALOG } from './theme.js';

test('saved dark preferences migrate to Islands Dark and unknown preferences safely use the original light theme', () => {
    assert.equal(normalizeTheme('dark'), 'islands-dark');
    assert.equal(normalizeTheme('light'), 'light');
    for (const value of [undefined, null, '', 'system', '<script>', {}]) assert.equal(normalizeTheme(value), 'light');
    for (const palette of THEME_CATALOG) {
        assert.equal(normalizeTheme(palette.id), palette.id);
        assert.ok(THEME_CATALOG.some((entry) => entry.id === palette.pairedTheme));
    }
});

test('each new palette keeps body text, labels, placeholders, disabled text and links readable on all neutral surfaces', () => {
    for (const palette of THEME_CATALOG.filter((entry) => entry.id !== 'light')) {
        const tokens = palette.tokens;
        for (const background of ['page', 'surface', 'surface-soft', 'surface-muted', 'input', 'primary-soft']) {
            for (const foreground of ['text', 'text-muted', 'text-soft', 'link']) {
                const ratio = contrastRatio(tokens[`--theme-${foreground}`], tokens[`--theme-${background}`]);
                assert.ok(ratio >= 4.5, `${palette.id}: ${foreground} on ${background} is ${ratio.toFixed(2)}:1`);
            }
        }
    }
});

test('buttons and meaningful status colors retain readable text, including hover states', () => {
    for (const palette of THEME_CATALOG) {
        const tokens = palette.tokens;
        for (const background of ['primary', 'primary-hover']) {
            assert.ok(contrastRatio(tokens['--theme-on-primary'], tokens[`--theme-${background}`]) >= 4.5, `${palette.id}: ${background} button`);
        }
        for (const state of ['success', 'warning', 'danger', 'info']) {
            assert.ok(contrastRatio(tokens[`--theme-${state}-text`], tokens[`--theme-${state}-soft`]) >= 4.5, `${palette.id}: ${state} label`);
            assert.ok(contrastRatio(tokens[`--theme-on-${state}`], tokens[`--theme-${state}-solid`]) >= 4.5, `${palette.id}: ${state} button`);
        }
    }
});

test('theme application follows appearance, clears dark mode when switching back, and replaces all palette tokens', () => {
    const classes = new Set();
    const properties = new Map();
    const root = { classList: { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) }, dataset: {}, style: { setProperty: (name, value) => properties.set(name, value) } };
    for (const id of ['dark', 'dracula', 'alucard', 'solarized-dark', 'solarized-light', 'nightfall', 'light']) {
        const palette = applyTheme(id, root);
        assert.equal(root.dataset.theme, normalizeTheme(id));
        assert.equal(root.style.colorScheme, palette.appearance);
        assert.equal(classes.has('dark'), palette.appearance === 'dark');
        for (const [name, value] of Object.entries(palette.tokens)) assert.equal(properties.get(name), value);
    }
});

test('original Light keeps its established palette and storage failures do not prevent theme selection', () => {
    const light = getTheme('light').tokens;
    assert.equal(light['--theme-page'], '#f4f8ff');
    assert.equal(light['--theme-primary'], '#155dfc');
    assert.equal(light['--theme-text-soft'], '#7890ae');
    assert.equal(light['--theme-border-strong'], '#b8ccec');
    assert.equal(getStoredTheme(), 'light');
    const previousWindow = globalThis.window;
    try {
        globalThis.window = { localStorage: { getItem: () => 'dark' } };
        assert.equal(getStoredTheme(), 'islands-dark');
        globalThis.window = { get localStorage() { throw new Error('Storage blocked'); } };
        assert.equal(getStoredTheme(), 'light');
    } finally {
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
    }
});
