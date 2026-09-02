import { cn } from "./utils";

const variantClasses = {
  default: "border-blue-200 bg-blue-50 text-blue-800",
  secondary: "border-slate-200 bg-slate-100 text-slate-700",
  outline: "border-slate-300 bg-transparent text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  destructive: "border-red-200 bg-red-50 text-red-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
};

function Badge({ className, variant = "default", ...props }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex max-w-full min-w-0 items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium leading-tight",
        variantClasses[variant] || variantClasses.default,
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
