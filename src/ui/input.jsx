import * as React from "react";
import { DatePickerInput } from "@mantine/dates";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "./utils";

const inputBaseClasses = [
  "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground",
  "dark:bg-input/30 border-input flex h-10 min-h-10 w-full min-w-0 rounded-lg border bg-white px-3 py-2 text-[16px] leading-5 text-slate-950 shadow-sm transition-[border-color,box-shadow,color,background-color]",
  "outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-100",
  "sm:text-sm",
  "focus-visible:border-[#155dfc] focus-visible:ring-2 focus-visible:ring-blue-100",
  "aria-invalid:border-red-500 aria-invalid:ring-2 aria-invalid:ring-red-100",
].join(" ");

function InputIcon({ side = "left", className, children }) {
  if (!children) return null;

  return (
    <span
      data-slot="input-icon"
      data-side={side}
      className={cn(
        "pointer-events-none absolute inset-y-0 z-10 flex w-10 items-center justify-center text-slate-400",
        side === "right" ? "right-0" : "left-0",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
    >
      {children}
    </span>
  );
}

function normalizeDateValue(value) {
  if (!value) return "";

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return "";
}

function createChangeEvent({ value, name, id }) {
  return {
    target: { value, name, id },
    currentTarget: { value, name, id },
  };
}

const Input = React.forwardRef(({
  className,
  containerClassName,
  type,
  leftIcon,
  rightIcon,
  value,
  defaultValue,
  onChange,
  min,
  max,
  name,
  id,
  placeholder,
  disabled,
  required,
  readOnly,
  ...props
}, ref) => {
  if (type === "date") {
    const isControlled = value !== undefined;
    const dateValueProps = isControlled
      ? { value: normalizeDateValue(value) || null }
      : { defaultValue: normalizeDateValue(defaultValue) || null };

    return (
      <DatePickerInput
        ref={ref}
        id={id}
        name={name}
        placeholder={placeholder || "Select date"}
        valueFormat="MM/DD/YYYY"
        minDate={normalizeDateValue(min) || undefined}
        maxDate={normalizeDateValue(max) || undefined}
        disabled={disabled}
        required={required}
        readOnly={readOnly}
        leftSection={leftIcon || undefined}
        leftSectionPointerEvents="none"
        rightSection={rightIcon || <CalendarIcon className="size-4" />}
        rightSectionPointerEvents="none"
        popoverProps={{
          withinPortal: true,
          zIndex: 120,
          shadow: "md",
          radius: "md",
        }}
        className={cn("w-full min-w-0", containerClassName)}
        classNames={{
          input: cn(
            inputBaseClasses,
            leftIcon && "pl-10",
            "min-w-[8.75rem] pr-10 text-left font-normal",
            className,
          ),
          day: "rounded-md text-sm font-semibold",
          calendarHeaderControl: "rounded-md",
          calendarHeaderLevel: "text-sm font-black text-slate-900",
          weekday: "text-xs font-black uppercase text-slate-500",
        }}
        onChange={(nextValue) => {
          const nextDate = normalizeDateValue(nextValue);
          onChange?.(createChangeEvent({ value: nextDate, name, id }));
        }}
        {...dateValueProps}
        {...props}
      />
    );
  }

  const input = (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      id={id}
      name={name}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      min={min}
      max={max}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      readOnly={readOnly}
      className={cn(
        inputBaseClasses,
        leftIcon && "pl-10",
        rightIcon && "pr-10",
        (type === "date" || type === "time" || type === "datetime-local" || type === "month") && "min-w-[8.75rem]",
        className,
      )}
      {...props}
    />
  );

  if (!leftIcon && !rightIcon) {
    return input;
  }

  return (
    <div data-slot="input-wrapper" className={cn("relative w-full min-w-0", containerClassName)}>
      <InputIcon side="left">{leftIcon}</InputIcon>
      {input}
      <InputIcon side="right">{rightIcon}</InputIcon>
    </div>
  );
});

Input.displayName = "Input";

export { Input, InputIcon };

