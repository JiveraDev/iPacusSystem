import { cn } from '../../ui/utils';

export default function PetActionDock({ children, label = 'Pet profile actions', className = '' }) {
    return (
        <div className="pet-action-dock-anchor pointer-events-none fixed inset-x-0 z-40 px-3 sm:px-5">
            <nav className={cn('pet-action-dock pointer-events-auto mx-auto flex w-full max-w-4xl gap-0.5 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-950/15 dark:border-slate-700 dark:bg-slate-900', className)} aria-label={label}>
                {children}
            </nav>
        </div>
    );
}
