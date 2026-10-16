export const THEME_STORAGE_KEY = 'ipawcus-theme';
export const THEME_OPTIONS = {
    LIGHT: 'light',
    DARK: 'dark',
    ISLANDS_LIGHT: 'islands-light',
    ISLANDS_DARK: 'islands-dark',
    DRACULA: 'dracula',
    ALUCARD: 'alucard',
    SOLARIZED_LIGHT: 'solarized-light',
    SOLARIZED_DARK: 'solarized-dark',
    NIGHTFALL: 'nightfall',
};

function rgb(hex) {
    return hex.replace('#', '').match(/.{2}/g).map((part) => Number.parseInt(part, 16));
}

function mix(color, target, amount) {
    const destination = rgb(target);
    return `#${rgb(color).map((value, index) => Math.round(value + (destination[index] - value) * amount).toString(16).padStart(2, '0')).join('')}`;
}

export function contrastRatio(first, second) {
    const luminance = (color) => rgb(color).map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
    const values = [luminance(first), luminance(second)].sort((left, right) => right - left);
    return (values[0] + 0.05) / (values[1] + 0.05);
}

// Editor comment colors are often too faint for small form labels. Keep their
// hue, increasing contrast only as far as the app's actual surfaces require.
function readable(color, backgrounds, dark, minimum = 4.5) {
    for (let step = 0; step <= 100; step += 1) {
        const candidate = mix(color, dark ? '#ffffff' : '#000000', step / 100);
        if (backgrounds.every((background) => contrastRatio(candidate, background) >= minimum)) return candidate;
    }
    return dark ? '#ffffff' : '#000000';
}

function buildTokens(seed, appearance) {
    const dark = appearance === 'dark';
    const primarySoft = mix(seed.surface, seed.accent, .12);
    const surfaces = [seed.page, seed.surface, seed.soft, seed.muted, seed.input || seed.surface, primarySoft];
    const primaryText = contrastRatio(seed.accent, '#ffffff') >= contrastRatio(seed.accent, '#17171c') ? '#ffffff' : '#17171c';
    const hover = mix(seed.accent, primaryText === '#ffffff' ? '#000000' : '#ffffff', .12);
    const tokens = {
        '--theme-page': seed.page,
        '--theme-surface': seed.surface,
        '--theme-surface-soft': seed.soft,
        '--theme-surface-muted': seed.muted,
        '--theme-surface-elevated': seed.surface,
        '--theme-input': seed.input || seed.surface,
        '--theme-border': seed.border || mix(seed.surface, seed.text, .18),
        '--theme-border-strong': readable(seed.border || seed.soft, [seed.input || seed.surface, seed.surface], dark, 3),
        '--theme-text': readable(seed.text, surfaces, dark),
        '--theme-text-muted': readable(seed.secondary, surfaces, dark),
        '--theme-text-soft': readable(seed.quiet, surfaces, dark),
        '--theme-primary': seed.accent,
        '--theme-primary-hover': hover,
        '--theme-on-primary': primaryText,
        '--theme-primary-soft': primarySoft,
        '--theme-link': readable(seed.link || seed.accent, surfaces, dark),
        '--theme-focus': readable(seed.accent, [seed.input || seed.surface, seed.page], dark, 3),
        '--theme-shadow': dark ? '0 1px 2px #00000025, 0 12px 28px #00000020' : '0 1px 3px #1820300c',
    };
    for (const [state, color] of Object.entries({ success: seed.success, warning: seed.warning, danger: seed.danger, info: seed.link || seed.accent })) {
        const background = mix(seed.surface, color, .1);
        tokens[`--theme-${state}-soft`] = background;
        tokens[`--theme-${state}-text`] = readable(color, [...surfaces, background], dark);
        tokens[`--theme-${state}-border`] = mix(seed.surface, color, .4);
        tokens[`--theme-${state}-solid`] = color;
        tokens[`--theme-on-${state}`] = contrastRatio(color, '#ffffff') >= contrastRatio(color, '#17171c') ? '#ffffff' : '#17171c';
    }
    return Object.freeze(tokens);
}

const definitions = [
    {
        id: 'light', label: 'Light', family: 'Original', appearance: 'light', description: 'The current iPawcus light theme.', pairedTheme: 'islands-dark',
        seed: { page: '#f4f8ff', surface: '#ffffff', soft: '#eef5ff', muted: '#dbeafe', border: '#d7e3f4', text: '#10213f', secondary: '#536782', quiet: '#7890ae', accent: '#155dfc', success: '#15803d', warning: '#a16207', danger: '#be123c' },
    },
    {
        id: 'islands-light', label: 'Islands Light', family: 'Islands', appearance: 'light', description: 'Cool gray canvas, white panels, blue accents.', pairedTheme: 'islands-dark',
        seed: { page: '#e7e8eb', surface: '#ffffff', soft: '#f4f5f7', muted: '#e8eaed', input: '#ffffff', text: '#25272a', secondary: '#50545c', quiet: '#656b75', accent: '#315fca', link: '#2454b5', success: '#25713e', warning: '#8a5b0b', danger: '#ba2f45' },
    },
    {
        id: 'islands-dark', label: 'Islands Dark', family: 'Islands', appearance: 'dark', description: 'Charcoal canvas, graphite panels, blue accents.', pairedTheme: 'islands-light',
        seed: { page: '#2b2d30', surface: '#191a1c', soft: '#24262a', muted: '#303237', input: '#1e1f22', text: '#dfe1e5', secondary: '#bcbec4', quiet: '#93979f', accent: '#315fca', link: '#8eb6ff', success: '#83c991', warning: '#e8b66b', danger: '#fa8d9b' },
    },
    {
        id: 'dracula', label: 'Dracula Classic', family: 'Dracula', appearance: 'dark', description: 'Purple-gray panels with lilac and cyan accents.', pairedTheme: 'alucard',
        seed: { page: '#21222c', surface: '#282a36', soft: '#343746', muted: '#44475a', text: '#f8f8f2', secondary: '#d6d4e8', quiet: '#a8afce', accent: '#bd93f9', link: '#8be9fd', success: '#50fa7b', warning: '#ffb86c', danger: '#ff5555' },
    },
    {
        id: 'alucard', label: 'Alucard Classic', family: 'Dracula', appearance: 'light', description: 'Dracula’s warm parchment light variant.', pairedTheme: 'dracula',
        seed: { page: '#ece9df', surface: '#fffbeb', soft: '#efeddc', muted: '#e2deca', text: '#1f1f1f', secondary: '#514b36', quiet: '#6c664b', accent: '#644ac9', link: '#036a96', success: '#14710a', warning: '#846e15', danger: '#cb3a2a' },
    },
    {
        id: 'solarized-light', label: 'Solarized Light', family: 'Solarized', appearance: 'light', description: 'Warm cream surfaces with blue and teal accents.', pairedTheme: 'solarized-dark',
        seed: { page: '#eee8d5', surface: '#fdf6e3', soft: '#f5efdc', muted: '#eee8d5', text: '#586e75', secondary: '#657b83', quiet: '#657b83', accent: '#006b96', link: '#006b96', success: '#526b00', warning: '#836200', danger: '#c3312e' },
    },
    {
        id: 'solarized-dark', label: 'Solarized Dark', family: 'Solarized', appearance: 'dark', description: 'Deep teal surfaces with restrained cyan accents.', pairedTheme: 'solarized-light',
        seed: { page: '#002b36', surface: '#073642', soft: '#0b3d47', muted: '#124650', input: '#002b36', text: '#93a1a1', secondary: '#839496', quiet: '#839496', accent: '#2aa198', link: '#60b6e6', success: '#b4c968', warning: '#e3bd61', danger: '#ff8e80' },
    },
    {
        id: 'nightfall', label: 'Nightfall', family: 'Nightfall', appearance: 'dark', description: 'Subliminal Nightfall: midnight, lavender, and teal.', pairedTheme: 'light',
        seed: { page: '#03021a', surface: '#0a0921', soft: '#111028', muted: '#211f39', text: '#e0def4', secondary: '#bcb8d1', quiet: '#a0a0b2', accent: '#5fb3b3', link: '#9ccfd8', success: '#a9cfa4', warning: '#fcb832', danger: '#e2848d' },
    },
];

export const THEME_CATALOG = Object.freeze(definitions.map((definition) => {
    let tokens = buildTokens(definition.seed, definition.appearance);
    // Preserve the original light theme exactly; its existing stylesheet owns
    // the colors. The extra semantic tokens are available to new primitives.
    if (definition.id === 'light') tokens = {
        ...tokens, '--theme-text-soft': '#7890ae', '--theme-border-strong': '#b8ccec', '--theme-primary-hover': '#0d4acf',
    };
    return Object.freeze({ ...definition, tokens: Object.freeze(tokens) });
}));

export function normalizeTheme(value) {
    if (value === THEME_OPTIONS.DARK) return THEME_OPTIONS.ISLANDS_DARK;
    return THEME_CATALOG.some((theme) => theme.id === value) ? value : THEME_OPTIONS.LIGHT;
}

export function getTheme(value) {
    return THEME_CATALOG.find((theme) => theme.id === normalizeTheme(value));
}

export function applyTheme(value, root = document.documentElement) {
    const palette = getTheme(value);
    root.classList.toggle('dark', palette.appearance === 'dark');
    root.dataset.theme = palette.id;
    root.style.colorScheme = palette.appearance;
    for (const [property, color] of Object.entries(palette.tokens)) root.style.setProperty(property, color);
    return palette;
}

export function getStoredTheme() {
    if (typeof window === 'undefined') {
        return THEME_OPTIONS.LIGHT;
    }

    try {
        return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
    } catch {
        return THEME_OPTIONS.LIGHT;
    }
}
