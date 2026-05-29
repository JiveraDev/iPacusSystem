import { Moon, Sun } from 'lucide-react';

import { useTheme } from '../../hooks/useTheme';
import { THEME_OPTIONS } from '../../lib/theme';
import { cn } from '../../ui/utils';

const themeOptions = [
    { value: THEME_OPTIONS.LIGHT, label: 'Light', icon: Sun },
    { value: THEME_OPTIONS.DARK, label: 'Dark', icon: Moon },
];

export default function ThemeToggle({ className = '' }) {
    const { theme, setTheme } = useTheme();

    return (
        <section className={cn('rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6', className)}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-lg font-bold text-slate-900">Theme</h3>
                    <p className="mt-1 text-sm text-slate-500">Choose your preferred display mode.</p>
                </div>

                <div className="grid w-full grid-cols-2 rounded-xl border border-slate-200 bg-slate-100 p-1 sm:w-[220px]">
                    {themeOptions.map((option) => {
                        const Icon = option.icon;
                        const isActive = theme === option.value;

                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setTheme(option.value)}
                                aria-pressed={isActive}
                                className={cn(
                                    'flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-bold transition-all',
                                    isActive
                                        ? 'bg-[#155dfc] text-white shadow-sm'
                                        : 'text-slate-600 hover:bg-white hover:text-slate-900',
                                )}
                            >
                                <Icon className="size-4" />
                                {option.label}
                            </button>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
