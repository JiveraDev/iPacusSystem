import * as React from "react";

import { cn } from "./utils";

const TabsContext = React.createContext(null);

function Tabs({ defaultValue, value, onValueChange, className, children, ...props }) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const currentValue = value ?? internalValue;

  const handleValueChange = React.useCallback(
    (nextValue) => {
      if (value === undefined) {
        setInternalValue(nextValue);
      }
      onValueChange?.(nextValue);
    },
    [onValueChange, value],
  );

  return (
    <TabsContext.Provider value={{ value: currentValue, onValueChange: handleValueChange }}>
      <div className={cn("w-full", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

function TabsList({ className, ...props }) {
  return (
    <div
      className={cn("max-w-full items-center overflow-x-auto rounded-lg bg-slate-100 p-1 text-slate-600 scrollbar-hide", className)}
      {...props}
    />
  );
}

function TabsTrigger({ value, className, ...props }) {
  const context = React.useContext(TabsContext);
  const isActive = context?.value === value;

  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-w-0 shrink-0 items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition",
        isActive ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
        className,
      )}
      onClick={() => context?.onValueChange(value)}
      {...props}
    />
  );
}

function TabsContent({ value, className, ...props }) {
  const context = React.useContext(TabsContext);

  if (context?.value !== value) {
    return null;
  }

  return <div className={cn("outline-none", className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
