import * as React from "react";

import { cn } from "./utils";

const Checkbox = React.forwardRef(({ className, checked, onCheckedChange, ...props }, ref) => {
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={!!checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      className={cn("h-4 w-4 rounded border-slate-300 accent-slate-900", className)}
      {...props}
    />
  );
});

Checkbox.displayName = "Checkbox";

export { Checkbox };
