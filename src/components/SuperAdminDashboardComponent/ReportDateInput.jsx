import { useState } from 'react';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';

function formatDateForDisplay(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
        return value || '';
    }

    const [year, month, day] = value.split('-');
    return `${month}/${day}/${year}`;
}

function normalizeTypedDate(value) {
    const text = String(value || '').trim();
    let month;
    let day;
    let year;

    const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const dashMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    const compactMatch = text.match(/^(\d{2})(\d{2})(\d{4})$/);

    if (slashMatch) {
        [, month, day, year] = slashMatch;
    } else if (dashMatch) {
        [, year, month, day] = dashMatch;
    } else if (compactMatch) {
        [, month, day, year] = compactMatch;
    } else {
        return null;
    }

    const normalizedMonth = String(Number(month)).padStart(2, '0');
    const normalizedDay = String(Number(day)).padStart(2, '0');
    const normalized = `${year}-${normalizedMonth}-${normalizedDay}`;
    const parsed = new Date(`${normalized}T00:00:00`);

    if (
        Number.isNaN(parsed.getTime())
        || parsed.getFullYear() !== Number(year)
        || parsed.getMonth() + 1 !== Number(month)
        || parsed.getDate() !== Number(day)
    ) {
        return null;
    }

    return normalized;
}

export default function ReportDateInput({ label, value, onChange }) {
    const [hasError, setHasError] = useState(false);

    const commitValue = (event) => {
        const normalized = normalizeTypedDate(event.currentTarget.value);

        if (!normalized) {
            setHasError(true);
            return;
        }

        setHasError(false);
        onChange(normalized);
        event.currentTarget.value = formatDateForDisplay(normalized);
    };

    return (
        <div className="min-w-0">
            <Label className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-300">
                {label}
            </Label>
            <Input
                key={value || 'empty-date'}
                type="text"
                defaultValue={formatDateForDisplay(value)}
                onChange={(event) => {
                    const cleanValue = event.target.value.replace(/[^\d/-]/g, '').slice(0, 10);
                    if (cleanValue !== event.target.value) {
                        event.target.value = cleanValue;
                    }
                    setHasError(false);
                }}
                onBlur={commitValue}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.currentTarget.blur();
                    }
                }}
                placeholder="MM/DD/YYYY"
                inputMode="numeric"
                containerClassName="w-full"
                aria-invalid={hasError}
                className={`w-full font-semibold tabular-nums dark:border-slate-700 dark:bg-slate-950 dark:text-white ${hasError ? 'border-red-300 bg-red-50 text-red-800 focus-visible:ring-red-500 dark:border-red-500 dark:bg-red-950/30 dark:text-red-100' : ''}`}
            />
            {hasError ? (
                <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-300">Use MM/DD/YYYY.</p>
            ) : null}
        </div>
    );
}
