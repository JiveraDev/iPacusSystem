import { Check, Moon, Sun } from 'lucide-react';

import { useTheme } from '../../hooks/useTheme';
import { THEME_CATALOG } from '../../lib/theme';
import { cn } from '../../ui/utils';

export default function ThemeToggle({ className = '' }) {
    const { theme, palette, setTheme } = useTheme();

    return (
        <section className={cn('theme-chooser', className)} aria-labelledby="theme-chooser-heading">
            <div className="theme-chooser-heading">
                <div>
                    <h3 id="theme-chooser-heading">Theme</h3>
                    <p>Choose a palette for your workspace. Your selection is saved on this browser.</p>
                </div>
                <span className="theme-current" aria-live="polite"><Check className="size-4" aria-hidden="true" />{palette.label}</span>
            </div>

            <fieldset>
                <legend className="sr-only">Workspace color theme</legend>
                <div className="theme-choice-grid">
                    {THEME_CATALOG.map((option) => {
                        const Icon = option.appearance === 'dark' ? Moon : Sun;
                        const selected = theme === option.id;
                        const colors = option.tokens;

                        return (
                            <label key={option.id} className="theme-choice" data-selected={selected}>
                                <input type="radio" name="workspace-theme" value={option.id} checked={selected} onChange={() => setTheme(option.id)} className="sr-only" aria-describedby={`theme-description-${option.id}`} />
                                <span className="theme-choice-preview" aria-hidden="true" style={{
                                    '--preview-page': colors['--theme-page'],
                                    '--preview-surface': colors['--theme-surface'],
                                    '--preview-soft': colors['--theme-surface-soft'],
                                    '--preview-text': colors['--theme-text'],
                                    '--preview-muted': colors['--theme-text-muted'],
                                    '--preview-primary': colors['--theme-primary'],
                                    '--preview-on-primary': colors['--theme-on-primary'],
                                }}>
                                    <span className="theme-preview-sidebar"><span /><span /><span /></span>
                                    <span className="theme-preview-panel"><span className="theme-preview-title">Aa</span><span className="theme-preview-line" /><span className="theme-preview-line theme-preview-line-short" /><span className="theme-preview-action">Continue</span></span>
                                </span>
                                <span className="theme-choice-title"><span>{option.label}</span><Icon className="size-4" aria-hidden="true" /></span>
                                <span id={`theme-description-${option.id}`} className="theme-choice-description">{option.description}</span>
                                <span className="theme-choice-meta"><span>{option.appearance === 'dark' ? 'Dark' : 'Light'}{option.family === 'Dracula' ? ' · Dracula' : ''}</span><span className="theme-choice-indicator" aria-hidden="true">{selected && <Check className="size-3" />}</span></span>
                            </label>
                        );
                    })}
                </div>
            </fieldset>
            <p className="theme-chooser-note">Status colors keep their meaning across themes. Documents and receipts keep their print colors.</p>
        </section>
    );
}
