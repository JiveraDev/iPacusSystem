import * as React from "react";

import { cn } from "./utils";

const RadioGroupContext = React.createContext(null);

function RadioGroup({ value, onValueChange, className, children, ...props }) {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange }}>
      <div className={cn("space-y-2", className)} {...props}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

const RadioGroupItem = React.forwardRef(({ value, className, ...props }, ref) => {
  const context = React.useContext(RadioGroupContext);

  return (
    <input
      ref={ref}
      type="radio"
      checked={context?.value === value}
      onChange={() => context?.onValueChange?.(value)}
      className={cn("h-4 w-4 accent-[#155dfc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155dfc] focus-visible:ring-offset-2", className)}
      {...props}
    />
  );
});

RadioGroupItem.displayName = "RadioGroupItem";

export { RadioGroup, RadioGroupItem };
