import * as React from 'react';

import { cn } from './utils';

const Checkbox = React.forwardRef(({
    className,
    checked,
    defaultChecked,
    onChange,
    onCheckedChange,
    ...props
}, ref) => {
    const isControlled = checked !== undefined;

    return (
        <input
            {...props}
            ref={ref}
            type="checkbox"
            checked={isControlled ? Boolean(checked) : undefined}
            defaultChecked={!isControlled ? defaultChecked : undefined}
            onChange={(event) => {
                onChange?.(event);
                onCheckedChange?.(event.target.checked);
            }}
            data-slot="checkbox"
            className={cn(
                'm-0 size-5 min-h-5 min-w-5 shrink-0 basis-5 cursor-pointer box-border appearance-auto rounded border-slate-300 accent-blue-700 align-middle disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:ring-offset-slate-950',
                className,
            )}
        />
    );
});

Checkbox.displayName = 'Checkbox';

export { Checkbox };
