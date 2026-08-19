import * as React from "react";

import { cn } from "./utils";

const Checkbox = React.forwardRef(({ className, checked, onCheckedChange, ...props }, ref) => {
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={!!checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      className={cn("h-4 w-4 rounded border-slate-300 accent-[#155dfc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155dfc] focus-visible:ring-offset-2", className)}
      {...props}
    />
  );
});

Checkbox.displayName = "Checkbox";

export { Checkbox };
