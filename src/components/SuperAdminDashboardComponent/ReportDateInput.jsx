import { Input } from '../../ui/input';
import { Label } from '../../ui/label';

export default function ReportDateInput({ label, value, onChange }) {
    return (
        <div className="min-w-0">
            <Label className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-300">
                {label}
            </Label>
            <Input
                type="date"
                value={value || ''}
                onChange={(event) => onChange(event.target.value)}
                className="min-w-[11.5rem] font-semibold dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
        </div>
    );
}
