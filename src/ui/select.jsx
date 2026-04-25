import * as React from "react";

import { cn } from "./utils";

function Select({ value, onValueChange, disabled, children }) {
  let placeholder = "";
  const options = [];

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) {
      return;
    }

    if (child.type?.displayName === "SelectTrigger") {
      React.Children.forEach(child.props.children, (triggerChild) => {
        if (React.isValidElement(triggerChild) && triggerChild.type?.displayName === "SelectValue") {
          placeholder = triggerChild.props.placeholder ?? "";
        }
      });
    }

    if (child.type?.displayName === "SelectContent") {
      React.Children.forEach(child.props.children, (item) => {
        if (React.isValidElement(item) && item.type?.displayName === "SelectItem") {
          options.push({
            value: item.props.value,
            disabled: item.props.disabled,
            label: item.props.children,
          });
        }
      });
    }
  });

  return (
    <select
      value={value ?? ""}
      onChange={(event) => onValueChange?.(event.target.value)}
      disabled={disabled}
      className={cn(
        "flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      <option value="" disabled hidden>
        {placeholder || "Select an option"}
      </option>
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function SelectTrigger({ children }) {
  return children ?? null;
}

SelectTrigger.displayName = "SelectTrigger";

function SelectValue() {
  return null;
}

SelectValue.displayName = "SelectValue";

function SelectContent({ children }) {
  return children ?? null;
}

SelectContent.displayName = "SelectContent";

function SelectItem({ children }) {
  return children ?? null;
}

SelectItem.displayName = "SelectItem";

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
