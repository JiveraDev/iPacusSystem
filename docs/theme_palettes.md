# Workspace theme palettes

Choose a theme in **Profile → Appearance**. All account roles use the same chooser. The selected palette stays in this browser under `ipawcus-theme`.

| Theme | Appearance | Canvas | Panel | Main text | Accent | Button text |
| --- | --- | --- | --- | --- | --- | --- |
| Light | Light, original | `#F4F8FF` | `#FFFFFF` | `#10213F` | `#155DFC` | White |
| Islands Light | Light | `#E7E8EB` | `#FFFFFF` | `#25272A` | `#315FCA` | White |
| Islands Dark | Dark | `#2B2D30` | `#191A1C` | `#DFE1E5` | `#315FCA` | White |
| Dracula Classic | Dark | `#21222C` | `#282A36` | `#F8F8F2` | `#BD93F9` | Dark ink |
| Alucard Classic | Light, Dracula family | `#ECE9DF` | `#FFFBEB` | `#1F1F1F` | `#644AC9` | White |
| Solarized Light | Light | `#EEE8D5` | `#FDF6E3` | Adapted from base01 | `#006B96` | White |
| Solarized Dark | Dark | `#002B36` | `#073642` | Adapted from base1 | `#2AA198` | Dark ink |
| Nightfall | Dark, Subliminal Nightfall | `#03021A` | `#0A0921` | `#E0DEF4` | `#5FB3B3` | Dark ink |

These are UI adaptations. Source base colors are retained where practical; text and controls use contrast-adjusted colors for small operational labels. The complete applied palette for each variant is exported as `THEME_CATALOG` in [theme.js](../src/lib/theme.js), including surface, border, input, focus, link, button, success, warning, danger, and information colors.

## Sources and application

### Islands

[JetBrains' Islands guidelines](https://plugins.jetbrains.com/docs/intellij/supporting-islands-theme.html) describe separate panel and canvas tones, restrained borders, and selected states with readable labels. The [Islands Dark port's source](https://github.com/bwya77/vscode-dark-islands/blob/main/themes/islands-dark.json) provides an additional concrete UI color reference. The app uses neutral gray panels, blue selection accents, and darker filled buttons for readable white action text. Islands Light uses the inverse surface hierarchy. This is an adaptation, not a JetBrains plugin or exact IDE reproduction.

Saved `dark` preferences migrate to `islands-dark`. The root `dark` class and browser `color-scheme` follow the variant's appearance, not its name.

### Dracula

The bundled variants are the public **Dracula Classic** and **Alucard Classic** palettes. The [official specification](https://draculatheme.com/spec), [Classic palette](https://draculatheme.com/contribute), and [Alucard source](https://github.com/dracula/cursor/blob/main/dev/src/alucard.yml) provide their base and UI values.

| Role | Dracula Classic | Alucard Classic |
| --- | --- | --- |
| Background | `#282A36` | `#FFFBEB` |
| Foreground | `#F8F8F2` | `#1F1F1F` |
| Selection | `#44475A` | `#CFCFDE` |
| Comment | `#6272A4` | `#6C664B` |
| Red | `#FF5555` | `#CB3A2A` |
| Orange | `#FFB86C` | `#A34D14` |
| Yellow | `#F1FA8C` | `#846E15` |
| Green | `#50FA7B` | `#14710A` |
| Cyan | `#8BE9FD` | `#036A96` |
| Purple | `#BD93F9` | `#644AC9` |
| Pink | `#FF79C6` | `#A3144D` |

Bright Dracula accents are reserved for controls and meaningful states; body text stays neutral. Classic's comment shade is not used unchanged for small helper labels. Pale lilac buttons use dark text.

[Dracula Pro](https://draculatheme.com/pro) separately lists Pro, Blade, Buffy, Lincoln, Morbius, Van Helsing, and Alucard. Those Pro variants are not bundled or presented as aliases of the public palettes.

### Solarized

[Ethan Schoonover's palette and usage notes](https://ethanschoonover.com/solarized/) define sixteen colors and the paired light/dark background and foreground roles.

| Base tones | Hex | Accents | Hex |
| --- | --- | --- | --- |
| base03 | `#002B36` | Yellow | `#B58900` |
| base02 | `#073642` | Orange | `#CB4B16` |
| base01 | `#586E75` | Red | `#DC322F` |
| base00 | `#657B83` | Magenta | `#D33682` |
| base0 | `#839496` | Violet | `#6C71C4` |
| base1 | `#93A1A1` | Blue | `#268BD2` |
| base2 | `#EEE8D5` | Cyan | `#2AA198` |
| base3 | `#FDF6E3` | Green | `#859900` |

The app preserves cream light surfaces and deep-teal dark surfaces. It strengthens small text against every neutral surface, darkens light-mode links and filled buttons, and keeps warning, danger, and success distinct. Original editor comment colors are not reused as faint form labels. Dark teal buttons use dark ink where that gives greater contrast.

### Nightfall

Nightfall uses the opaque base of [Subliminal Nightfall's palette source](https://github.com/mhamrah/subliminal-nightfall/blob/main/theme.toml): midnight backgrounds, lavender-neutral foreground, teal accents, green success, amber warning, and rose error. Transparent terminal variants are not used for operational forms.

## Readability and integration

- New palettes' text, muted text, helper/placeholder/disabled text, and links meet a minimum 4.5:1 against the supported neutral surfaces. Filled button and status-label pairs are checked separately, including hover states.
- Focus indicators and control boundaries have dedicated colors. Selecting a theme updates all shared tokens immediately; switching to a light variant removes dark mode.
- Mantine date controls and report-chart axis/legend text use the selected palette.
- Legacy neutral and semantic utility colors are mapped in [themeVariants.css](../src/styles/themeVariants.css) and [themeCompatibility.css](../src/styles/themeCompatibility.css). The compatibility rules cover page-specific colors and retain the conditions on dark, hover, and focus utilities. New components should use the shared tokens directly.
- Original Light retains its established colors. Fixed-color documents, consent forms, receipts, and print layouts keep their light presentation.
- Palettes ship with the app and require no network/API call at runtime.

Run `node --test src/lib/theme.test.js` for preference migration, appearance switching, original-Light preservation, and palette contrast checks. Browser review also covers rendered labels, tables, forms, the theme chooser, persistence, and responsive layouts using synthetic records.

## Public theme selector

The sun-and-moon icon in the landing header opens a compact selector with all eight themes. The selector appears only on the landing page; login, account registration, profile registration, email verification, and password recovery inherit the chosen theme. These screens share `ThemeProvider` and the `ipawcus-theme` preference with the dashboard. Authentication is not required to choose a theme.

The selector uses native radio controls, supports arrow keys, restores trigger focus on Escape, and closes when focus or a pointer moves outside. Its phone layout stays inside the viewport. Public page colors are mapped in [publicThemes.css](../src/styles/publicThemes.css); the original Light colors remain the default. Registration terms and printable documents keep their document presentation.

See [the theme audit](theme_audit.md) for route coverage and testing limits.
