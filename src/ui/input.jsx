import * as React from "react";

import { cn } from "./utils";

const inputBaseClasses = [
  "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground",
  "dark:bg-input/30 border-input flex h-10 min-h-10 w-full min-w-0 rounded-lg border bg-white px-3 py-2 text-[16px] leading-5 text-slate-950 shadow-sm transition-[border-color,box-shadow,color,background-color]",
  "outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-100",
  "sm:text-sm",
  "focus-visible:border-[#155dfc] focus-visible:ring-2 focus-visible:ring-blue-100",
  "aria-invalid:border-red-500 aria-invalid:ring-2 aria-invalid:ring-red-100",
].join(" ");

function InputIcon({ side = "left", className, children }) {
  if (!children) return null;

  return (
    <span
      data-slot="input-icon"
      data-side={side}
      className={cn(
        "pointer-events-none absolute inset-y-0 z-10 flex w-10 items-center justify-center text-slate-400",
        side === "right" ? "right-0" : "left-0",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
    >
      {children}
    </span>
  );
}

const Input = React.forwardRef(({
  className,
  containerClassName,
  type,
  leftIcon,
  rightIcon,
  ...props
}, ref) => {
  const input = (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(
        inputBaseClasses,
        leftIcon && "pl-10",
        rightIcon && "pr-10",
        (type === "date" || type === "time" || type === "datetime-local" || type === "month") && "min-w-[8.75rem]",
        className,
      )}
      {...props}
    />
  );

  if (!leftIcon && !rightIcon) {
    return input;
  }

  return (
    <div data-slot="input-wrapper" className={cn("relative w-full min-w-0", containerClassName)}>
      <InputIcon side="left">{leftIcon}</InputIcon>
      {input}
      <InputIcon side="right">{rightIcon}</InputIcon>
    </div>
  );
});

Input.displayName = "Input";

export { Input, InputIcon };

