import * as React from "react";

import { cn } from "./utils";

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";

export { Textarea };
