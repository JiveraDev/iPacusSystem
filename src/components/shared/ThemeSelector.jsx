import { useEffect, useId, useRef, useState } from 'react';
import { Check, Moon, Sun } from 'lucide-react';

import { useTheme } from '../../hooks/useTheme';
import { THEME_CATALOG } from '../../lib/theme';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';

export default function ThemeSelector() {
    const { theme, palette, setTheme } = useTheme();
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);
    const triggerRef = useRef(null);
    const id = useId();
    const ThemeIcon = palette.appearance === 'dark' ? Moon : Sun;

    useEffect(() => {
        if (!open) return undefined;
        rootRef.current?.querySelector('input:checked')?.focus();

        const dismissOutside = (event) => {
            if (!rootRef.current?.contains(event.target)) setOpen(false);
        };
        const dismissEscape = (event) => {
            if (event.key !== 'Escape') return;
            event.stopPropagation();
            setOpen(false);
            triggerRef.current?.focus();
        };
        document.addEventListener('pointerdown', dismissOutside);
        document.addEventListener('focusin', dismissOutside);
        rootRef.current?.addEventListener('keydown', dismissEscape);
        const root = rootRef.current;
        return () => {
            document.removeEventListener('pointerdown', dismissOutside);
            document.removeEventListener('focusin', dismissOutside);
            root?.removeEventListener('keydown', dismissEscape);
        };
    }, [open]);

    return (
        <div ref={rootRef} className="public-theme-selector">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button ref={triggerRef} type="button" className="public-theme-trigger" aria-label={`Choose theme, current: ${palette.label}`} title={`Theme: ${palette.label}`} aria-expanded={open} aria-controls={`${id}-choices`}>
                        <ThemeIcon size={24} aria-hidden="true" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="public-theme-panel">
                    <fieldset id={`${id}-choices`}>
                        <legend>Choose your theme</legend>
                        <p>Used across iPawcus, including login and registration.</p>
                        <div className="public-theme-options">
                            {THEME_CATALOG.map((option) => (
                                <label key={option.id} className="public-theme-option" data-selected={theme === option.id}>
                                    <input className="sr-only" type="radio" name={`${id}-theme`} value={option.id} checked={theme === option.id} onChange={() => setTheme(option.id)} />
                                    <span className="public-theme-swatch" aria-hidden="true" style={{ background: option.tokens['--theme-page'], borderColor: option.tokens['--theme-text-muted'] }}><span style={{ background: option.tokens['--theme-primary'] }} /></span>
                                    <span className="public-theme-option-name">{option.label}<small>{option.appearance === 'dark' ? 'Dark' : 'Light'}</small></span>
                                    {theme === option.id && <Check size={16} aria-hidden="true" />}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                </PopoverContent>
            </Popover>
        </div>
    );
}
