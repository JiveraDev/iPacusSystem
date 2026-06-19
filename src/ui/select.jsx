import * as React from "react";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { cn } from "./utils";

const SelectContext = React.createContext(null);

function getNodeText(node) {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getNodeText).join(" ");
  }

  if (React.isValidElement(node)) {
    return getNodeText(node.props.children);
  }

  return "";
}

function flattenChildren(children) {
  const flattened = [];

  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === React.Fragment) {
      flattened.push(...flattenChildren(child.props.children));
    } else {
      flattened.push(child);
    }
  });

  return flattened;
}

function isSelectItem(child) {
  return React.isValidElement(child)
    && (child.type === SelectItem || child.type?.displayName === "SelectItem");
}

function Select({
  value,
  onValueChange,
  children,
  disabled = false,
  searchable = true,
  searchPlaceholder = "Search options",
  emptyMessage = "No matching options.",
  allowCustom = false,
  customOptionLabel,
  onCreateOption,
}) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
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

  React.useEffect(() => {
    if (!open) {
      setSearchQuery("");
    }
  }, [open]);

  const handleSelect = React.useCallback((val) => {
    if (disabled) return;
    onValueChange?.(val);
    setOpen(false);
  }, [disabled, onValueChange]);

  const handleCreateOption = React.useCallback((label) => {
    if (disabled) return;
    onCreateOption?.(label);
    setSearchQuery("");
    setOpen(false);
  }, [disabled, onCreateOption]);

  return (
    <SelectContext.Provider value={{
      value,
      onValueChange: handleSelect,
      open,
      setOpen,
      disabled,
      searchable,
      searchPlaceholder,
      emptyMessage,
      searchQuery,
      setSearchQuery,
      allowCustom,
      customOptionLabel,
      onCreateOption: handleCreateOption,
    }}>
      <div ref={containerRef} className="relative w-full min-w-0">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

function SelectTrigger({ className, children, ...props }) {
  const { open, setOpen, disabled } = React.useContext(SelectContext);

  return (
    <button
      type="button"
      {...props}
      disabled={disabled}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) {
          setOpen(!open);
        }
      }}
      className={cn(
        "flex h-10 w-full min-w-0 items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
      <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform duration-200", open && "rotate-180")} />
    </button>
  );
}

SelectTrigger.displayName = "SelectTrigger";

function SelectValue({ placeholder, displayValue }) {
  const { value } = React.useContext(SelectContext);

  return (
    <span className="block truncate">
      {displayValue || value || <span className="text-slate-500">{placeholder}</span>}
    </span>
  );
}

SelectValue.displayName = "SelectValue";

function SelectContent({ children, className }) {
  const {
    open,
    searchable,
    searchPlaceholder,
    emptyMessage,
    searchQuery,
    setSearchQuery,
    allowCustom,
    customOptionLabel,
    onCreateOption,
  } = React.useContext(SelectContext);

  if (!open) return null;

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const childItems = flattenChildren(children);
  let matchedItemCount = 0;
  let exactMatch = false;

  const filteredChildren = childItems.map((child) => {
    if (!isSelectItem(child)) {
      return child;
    }

    const searchText = [
      child.props.value,
      child.props.searchText,
      getNodeText(child.props.children),
    ].filter(Boolean).join(" ").toLowerCase();

    if (normalizedQuery && !searchText.includes(normalizedQuery)) {
      return null;
    }

    matchedItemCount += 1;
    const labelText = getNodeText(child.props.children).trim().toLowerCase();
    const explicitText = String(child.props.searchText || "").trim().toLowerCase();
    if (normalizedQuery && (
      String(child.props.value || "").trim().toLowerCase() === normalizedQuery
      || labelText === normalizedQuery
      || explicitText === normalizedQuery
    )) {
      exactMatch = true;
    }

    return child;
  }).filter(Boolean);

  const canCreate = allowCustom
    && normalizedQuery
    && !exactMatch
    && typeof onCreateOption === "function";

  return (
    <div
      className={cn(
        "absolute z-50 mt-1 min-w-full max-w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-md border border-slate-200 bg-white text-slate-950 shadow-md animate-in fade-in zoom-in-95",
        className
      )}
    >
      {searchable && (
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canCreate) {
                  event.preventDefault();
                  onCreateOption(searchQuery.trim());
                }
              }}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-[#155dfc] focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      )}

      <div className="max-h-60 overflow-auto p-1">
        {matchedItemCount > 0 ? filteredChildren : (
          <div className="px-3 py-4 text-center text-sm font-semibold text-slate-500">
            {emptyMessage}
          </div>
        )}
        {canCreate && (
          <button
            type="button"
            onClick={() => onCreateOption(searchQuery.trim())}
            className="mt-1 flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-semibold text-[#155dfc] outline-none hover:bg-blue-50"
          >
            <Plus className="h-4 w-4" />
            {typeof customOptionLabel === "function"
              ? customOptionLabel(searchQuery.trim())
              : `Add "${searchQuery.trim()}"`}
          </button>
        )}
      </div>
    </div>
  );
}

SelectContent.displayName = "SelectContent";

function SelectItem({ value: itemValue, children, className, disabled = false }) {
  const { value: selectedValue, onValueChange } = React.useContext(SelectContext);
  const isSelected = selectedValue === itemValue;

  return (
    <div
      onClick={() => {
        if (!disabled) {
          onValueChange(itemValue);
        }
      }}
      aria-disabled={disabled}
      data-disabled={disabled ? "" : undefined}
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
