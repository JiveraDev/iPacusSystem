import * as React from "react";
import { cn } from "./utils";

const PopoverContext = React.createContext(null);

export const Popover = ({ children, open, onOpenChange }) => {
  return (
    <PopoverContext.Provider value={{ open, onOpenChange }}>
      {children}
    </PopoverContext.Provider>
  );
};

export const PopoverTrigger = ({ children, asChild }) => {
  const { open, onOpenChange } = React.useContext(PopoverContext);
  return (
    <div onClick={() => onOpenChange(!open)} style={{ cursor: "pointer" }}>
      {children}
    </div>
  );
};

export const PopoverContent = ({ children, className }) => {
  const { open } = React.useContext(PopoverContext);
  if (!open) return null;
  return (
    <div className={cn("absolute z-50 mt-2 bg-white rounded-md border shadow-lg", className)}>
      {children}
    </div>
  );
};
