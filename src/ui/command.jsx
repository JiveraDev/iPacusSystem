import * as React from "react";
import { cn } from "./utils";

export const Command = ({ children, className }) => (
  <div className={cn("flex h-full w-full flex-col overflow-hidden rounded-md bg-white", className)}>{children}</div>
);

export const CommandInput = ({ placeholder, ...props }) => (
  <input
    className="flex h-10 w-full rounded-md bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-500"
    placeholder={placeholder}
    {...props}
  />
);

export const CommandList = ({ children }) => <div className="max-h-[300px] overflow-y-auto overflow-x-hidden">{children}</div>;

export const CommandEmpty = ({ children }) => <div className="py-6 text-center text-sm">{children}</div>;

export const CommandGroup = ({ children }) => <div className="overflow-hidden p-1 text-slate-900">{children}</div>;

export const CommandItem = ({ children, onSelect, className }) => (
  <div
    className={cn("relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-slate-100", className)}
    onClick={onSelect}
  >
    {children}
  </div>
);
