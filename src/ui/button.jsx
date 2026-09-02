import * as React from "react";

import { cn } from "./utils";

const baseClasses =
  "inline-flex max-w-full min-w-0 items-center justify-center gap-2 whitespace-normal break-words rounded-lg text-center text-sm font-bold leading-tight transition-[transform,background-color,border-color,color,box-shadow] duration-200 sm:whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0";

const variantClasses = {
  default: "bg-[#155dfc] text-white shadow-sm shadow-blue-950/10 hover:bg-[#0d4acf] hover:shadow-md",
  secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
  outline: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
  ghost: "text-slate-900 hover:bg-slate-100",
  link: "text-slate-900 underline-offset-4 hover:underline",
  destructive: "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-600",
  success: "bg-emerald-700 text-white hover:bg-emerald-800 focus-visible:ring-emerald-700",
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

function buttonText(children) {
  return React.Children.toArray(children).map((child) => {
    if (typeof child === "string" || typeof child === "number") return String(child).trim();
    if (!React.isValidElement(child)) return "";
    return buttonText(child.props?.children);
  }).filter(Boolean).join(" ");
}

const Button = React.forwardRef(({ className, variant, size, children, ...props }, ref) => {
  const childArray = React.Children.toArray(children);
  const hasIcon = childArray.some((child) => React.isValidElement(child));
  const label = buttonText(children);
  const hasIconLabel = Boolean(hasIcon && label);

  return (
    <button
      ref={ref}
      data-slot="button"
      aria-label={props["aria-label"] || (hasIconLabel ? label : undefined)}
      title={props.title || (hasIconLabel ? label : undefined)}
      className={buttonVariants({ variant, size, className })}
      {...props}
    >
      {children}
    </button>
  );
});

Button.displayName = "Button";

export { Button };
// eslint-disable-next-line react-refresh/only-export-components
export { buttonVariants };
