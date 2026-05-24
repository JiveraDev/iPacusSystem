import { cn } from "./utils";

function Badge({ className, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full min-w-0 items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium leading-tight",
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
