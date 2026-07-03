import * as React from "react";

import { cn } from "./utils";

const baseClasses =
  "inline-flex max-w-full min-w-0 items-center justify-center gap-2 whitespace-normal break-words rounded-lg text-center text-sm font-semibold leading-tight transition-colors sm:whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155dfc] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0";

const variantClasses = {
  default: "bg-slate-900 text-white hover:bg-slate-800",
  secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
  outline: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
  ghost: "text-slate-900 hover:bg-slate-100",
  link: "text-slate-900 underline-offset-4 hover:underline",
};

const sizeClasses = {
  default: "min-h-10 px-3 py-2 sm:px-4",
  sm: "min-h-9 px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm",
  lg: "min-h-11 px-4 py-2.5 sm:px-5",
  icon: "size-10 shrink-0 p-0",
};

function buttonVariants({ variant = "default", size = "default", className } = {}) {
  return cn(baseClasses, variantClasses[variant], sizeClasses[size], className);
}

const Button = React.forwardRef(({ className, variant, size, ...props }, ref) => {
  return (
    <button
      ref={ref}
      data-slot="button"
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
});

Button.displayName = "Button";

export { Button };
// eslint-disable-next-line react-refresh/only-export-components
export { buttonVariants };
