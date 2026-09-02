import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { cn } from "./utils";
import { Input } from "./input";

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

function findSelectItemLabel(children, selectedValue) {
  let match = "";

  React.Children.forEach(children, (child) => {
    if (match || !React.isValidElement(child)) return;

    if (isSelectItem(child) && String(child.props.value) === String(selectedValue)) {
      match = getNodeText(child.props.children).trim();
      return;
    }

    if (child.props?.children) {
      match = findSelectItemLabel(child.props.children, selectedValue);
    }
  });

  return match;
}

function Select({
  value,
  onValueChange,
  children,
  disabled = false,
  searchable = "auto",
  searchPlaceholder = "Search options",
  emptyMessage = "No matching options.",
  allowCustom = false,
  customOptionLabel,
  onCreateOption,
}) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [contentStyle, setContentStyle] = React.useState(null);
  const containerRef = React.useRef(null);
  const contentRef = React.useRef(null);
  const triggerRef = React.useRef(null);
  const generatedId = React.useId().replace(/:/g, "");
  const triggerId = `select-trigger-${generatedId}`;
  const listboxId = `select-listbox-${generatedId}`;
  const selectedLabel = React.useMemo(
    () => findSelectItemLabel(children, value),
    [children, value]
  );

  const updateContentPosition = React.useCallback(() => {
    const trigger = containerRef.current;
    if (!trigger || typeof window === "undefined") return;

    const rect = trigger.getBoundingClientRect();
    const padding = 8;
    const contentWidth = contentRef.current?.offsetWidth || rect.width;
    const contentHeight = contentRef.current?.offsetHeight || 0;
    const availableBelow = window.innerHeight - rect.bottom - padding;
    const availableAbove = rect.top - padding;
    const shouldOpenUp = contentHeight > availableBelow && availableAbove > availableBelow;
    const availableHeight = Math.max(120, shouldOpenUp ? availableAbove - 4 : availableBelow - 4);
    const estimatedHeight = contentHeight || Math.min(320, availableHeight);
    const maxTop = window.innerHeight - padding - Math.min(estimatedHeight, window.innerHeight - (padding * 2));
    let top = shouldOpenUp ? rect.top - estimatedHeight - 4 : rect.bottom + 4;
    let left = rect.left;

    if (left + contentWidth > window.innerWidth - padding) {
      left = window.innerWidth - padding - contentWidth;
    }

    setContentStyle({
      top: `${Math.max(padding, Math.min(top, maxTop))}px`,
      left: `${Math.max(padding, left)}px`,
      minWidth: `${rect.width}px`,
      maxWidth: `calc(100vw - ${padding * 2}px)`,
      maxHeight: `${Math.min(availableHeight, window.innerHeight - (padding * 2))}px`,
      visibility: "visible",
    });
  }, []);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target;
      const isTriggerClick = containerRef.current?.contains(target);
      const isContentClick = contentRef.current?.contains(target);

      if (!isTriggerClick && !isContentClick) {
        setOpen(false);
      }
    };

    if (!open) return undefined;

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  React.useLayoutEffect(() => {
    if (!open) return undefined;

    updateContentPosition();
    window.addEventListener("resize", updateContentPosition);
    window.addEventListener("scroll", updateContentPosition, true);

    return () => {
      window.removeEventListener("resize", updateContentPosition);
      window.removeEventListener("scroll", updateContentPosition, true);
    };
  }, [open, updateContentPosition]);

  React.useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setContentStyle(null);
    }
  }, [open]);

  const handleSelect = React.useCallback((val) => {
    if (disabled) return;
    onValueChange?.(val);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [disabled, onValueChange]);

  const handleCreateOption = React.useCallback((label) => {
    if (disabled) return;
    onCreateOption?.(label);
    setSearchQuery("");
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [disabled, onCreateOption]);

  const closeAndRestoreFocus = React.useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

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
      contentRef,
      contentStyle,
      updateContentPosition,
      triggerRef,
      triggerId,
      listboxId,
      selectedLabel,
      closeAndRestoreFocus,
    }}>
      <div ref={containerRef} className="relative w-full min-w-0">
        <input
          type="hidden"
          value={value ?? ""}
          readOnly
          data-session-persist="select"
          onInput={(event) => handleSelect(event.currentTarget.value)}
        />
        {children}
      </div>
    </SelectContext.Provider>
  );
}

function SelectTrigger({ className, children, ...props }) {
  const { open, setOpen, disabled, triggerRef, triggerId, listboxId, closeAndRestoreFocus } = React.useContext(SelectContext);

  return (
    <button
      type="button"
      {...props}
      data-slot="select-trigger"
      ref={triggerRef}
      id={props.id || triggerId}
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listboxId}
      disabled={disabled}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) {
          setOpen(!open);
        }
      }}
      onKeyDown={(event) => {
        props.onKeyDown?.(event);
        if (event.defaultPrevented) return;

        if (event.key === "ArrowDown") {
          event.preventDefault();
          setOpen(true);
        } else if (event.key === "Escape" && open) {
          event.preventDefault();
          closeAndRestoreFocus();
        }
      }}
      className={cn(
        "flex min-h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold leading-5 text-slate-900 shadow-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-100 [&_svg]:size-4 [&_svg]:shrink-0",
        className
      )}
    >
      {children}
      <ChevronDown className={cn("opacity-50 transition-transform duration-200", open && "rotate-180")} />
    </button>
  );
}

SelectTrigger.displayName = "SelectTrigger";

function SelectValue({ placeholder, displayValue }) {
  const { value, selectedLabel } = React.useContext(SelectContext);

  return (
    <span className="block min-w-0 flex-1 truncate">
      {displayValue || selectedLabel || value || <span className="text-slate-500">{placeholder}</span>}
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
    contentRef,
    contentStyle,
    updateContentPosition,
    listboxId,
    closeAndRestoreFocus,
  } = React.useContext(SelectContext);

  const childItems = flattenChildren(children);
  const selectableItemCount = childItems.filter(isSelectItem).length;
  const shouldSearch = searchable === true || (searchable !== false && selectableItemCount > 8);

  React.useLayoutEffect(() => {
    if (open) {
      updateContentPosition?.();
    }
  }, [children, open, searchQuery, updateContentPosition]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
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

  const portalStyle = contentStyle || {
    top: 0,
    left: 0,
    minWidth: 0,
    visibility: "hidden",
  };

  React.useEffect(() => {
    if (!open || shouldSearch) return undefined;

    const focusTimer = window.requestAnimationFrame(() => {
      const selectedOption = contentRef.current?.querySelector('[role="option"][aria-selected="true"]');
      const firstOption = contentRef.current?.querySelector('[role="option"]:not([aria-disabled="true"])');
      (selectedOption || firstOption)?.focus();
    });

    return () => window.cancelAnimationFrame(focusTimer);
  }, [contentRef, open, searchQuery, shouldSearch]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={contentRef}
      data-slot="select-content"
      id={listboxId}
      role="listbox"
      style={portalStyle}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeAndRestoreFocus();
        }
      }}
      className={cn(
        "fixed z-[2200] overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-950 shadow-xl animate-in fade-in zoom-in-95",
        className
      )}
    >
      {shouldSearch && (
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white p-2">
          <div className="relative">
            <Input
              autoFocus
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeAndRestoreFocus();
                  return;
                }

                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  contentRef.current?.querySelector('[role="option"]:not([aria-disabled="true"])')?.focus();
                  return;
                }

                if (event.key === "Enter" && canCreate) {
                  event.preventDefault();
                  onCreateOption(searchQuery.trim());
                }
              }}
              placeholder={searchPlaceholder}
              leftIcon={<Search />}
              className="h-9 min-h-9 text-sm"
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
            className="mt-1 flex min-h-10 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-[#155dfc] outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-[#155dfc]"
          >
            <Plus className="size-4 shrink-0" />
            {typeof customOptionLabel === "function"
              ? customOptionLabel(searchQuery.trim())
              : `Add "${searchQuery.trim()}"`}
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}

SelectContent.displayName = "SelectContent";

function SelectItem({ value: itemValue, children, className, disabled = false }) {
  const { value: selectedValue, onValueChange, closeAndRestoreFocus } = React.useContext(SelectContext);
  const isSelected = selectedValue === itemValue;

  const focusSibling = (element, direction) => {
    const options = Array.from(element.parentElement?.querySelectorAll('[role="option"]:not([aria-disabled="true"])') || []);
    const currentIndex = options.indexOf(element);
    const nextIndex = Math.min(Math.max(currentIndex + direction, 0), options.length - 1);
    options[nextIndex]?.focus();
  };

  return (
    <div
      role="option"
      tabIndex={disabled ? -1 : 0}
      aria-selected={isSelected}
      onClick={() => {
        if (!disabled) {
          onValueChange(itemValue);
        }
      }}
      onKeyDown={(event) => {
        if (disabled) return;

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onValueChange(itemValue);
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          focusSibling(event.currentTarget, 1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          focusSibling(event.currentTarget, -1);
        } else if (event.key === "Home") {
          event.preventDefault();
          event.currentTarget.parentElement?.querySelector('[role="option"]:not([aria-disabled="true"])')?.focus();
        } else if (event.key === "End") {
          event.preventDefault();
          const options = event.currentTarget.parentElement?.querySelectorAll('[role="option"]:not([aria-disabled="true"])');
          options?.[options.length - 1]?.focus();
        } else if (event.key === "Escape") {
          event.preventDefault();
          closeAndRestoreFocus();
        }
      }}
      aria-disabled={disabled}
      data-disabled={disabled ? "" : undefined}
      className={cn(
        "relative flex min-h-9 w-full cursor-default select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-slate-100 hover:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        isSelected && "bg-blue-50 font-bold text-blue-800",
        className
      )}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {isSelected && <Check className="size-4" />}
      </span>
      {children}
    </div>
  );
}

SelectItem.displayName = "SelectItem";

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
