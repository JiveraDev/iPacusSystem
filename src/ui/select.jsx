import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "./utils";

const SelectContext = React.createContext(null);

function Select({ value, onValueChange, children }) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = React.useCallback((val) => {
    onValueChange?.(val);
    setOpen(false);
  }, [onValueChange]);

  return (
    <SelectContext.Provider value={{ value, onValueChange: handleSelect, open, setOpen }}>
      <div ref={containerRef} className="relative w-full">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

function SelectTrigger({ className, children }) {
  const { open, setOpen } = React.useContext(SelectContext);
  
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
      <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform duration-200", open && "rotate-180")} />
    </button>
  );
}

SelectTrigger.displayName = "SelectTrigger";

function SelectValue({ placeholder }) {
  const { value } = React.useContext(SelectContext);
  
  // We'll capture the label from SelectItem children if matched
  // For simplicity in this implementation, we assume the children of SelectItem is the label
  return (
    <span className="block truncate">
      {value || <span className="text-slate-500">{placeholder}</span>}
    </span>
  );
}

SelectValue.displayName = "SelectValue";

function SelectContent({ children, className }) {
  const { open } = React.useContext(SelectContext);

  if (!open) return null;

  return (
    <div
      className={cn(
        "absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white p-1 text-slate-950 shadow-md animate-in fade-in zoom-in-95",
        className
      )}
    >
      {children}
    </div>
  );
}

SelectContent.displayName = "SelectContent";

function SelectItem({ value: itemValue, children, className }) {
  const { value: selectedValue, onValueChange } = React.useContext(SelectContext);
  const isSelected = selectedValue === itemValue;

  return (
    <div
      onClick={() => onValueChange(itemValue)}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-slate-100 hover:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        isSelected && "bg-slate-50 font-medium text-[#155dfc]",
        className
      )}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {isSelected && <Check className="h-4 w-4" />}
      </span>
      {children}
    </div>
  );
}

SelectItem.displayName = "SelectItem";

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
