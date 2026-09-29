import * as React from "react";

import { cn } from "./utils";

const baseClasses =
  "inline-flex max-w-full min-w-0 items-center justify-center gap-2 whitespace-normal break-words rounded-lg text-center text-sm font-bold leading-tight transition-[transform,background-color,border-color,color,box-shadow] duration-200 sm:whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0";

const variantClasses = {
  default: "bg-[#155dfc] text-white shadow-sm shadow-blue-950/10 hover:bg-[#0d4acf] hover:shadow-md",
  secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
  outline: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
  ghost: "text-slate-900 hover:bg-slate-100",
  link: "text-slate-900 underline-offset-4 hover:underline",
  destructive: "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-600",
  success: "bg-emerald-700 text-white hover:bg-emerald-800 focus-visible:ring-emerald-700",
};

const sizeClasses = {
  default: "min-h-10 px-3 py-2 sm:px-4",
  sm: "min-h-9 px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm",
  lg: "min-h-11 px-4 py-2.5 sm:px-5",
  icon: "size-10 shrink-0 p-0",
};

function buttonVariants({ variant = "default", size = "default", className } = {}) {
  return cn(baseClasses, variantClasses[variant], sizeClasses[size], className);
}

function buttonText(children) {
  return React.Children.toArray(children).map((child) => {
    if (typeof child === "string" || typeof child === "number") return String(child).trim();
    if (!React.isValidElement(child)) return "";
    return buttonText(child.props?.children);
  }).filter(Boolean).join(" ");
}

function wrapButtonLabels(children) {
  return React.Children.map(children, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      return String(child).trim() === ""
        ? child
        : <span data-slot="button-label">{child}</span>;
    }

    if (React.isValidElement(child) && child.type === React.Fragment) {
      return React.cloneElement(child, undefined, wrapButtonLabels(child.props.children));
    }

    if (React.isValidElement(child) && child.type === "span" && buttonText(child.props.children)) {
      return React.cloneElement(child, {
        ...child.props,
        "data-slot": child.props["data-slot"] || "button-label",
      });
    }

    return child;
  });
}

const Button = React.forwardRef(({ className, variant, size, children, ...props }, ref) => {
  const childArray = React.Children.toArray(children);
  const hasIcon = childArray.some((child) => React.isValidElement(child));
  const label = buttonText(children);
  const hasIconLabel = Boolean(hasIcon && label);
  const internalRef = React.useRef(null);
  const requiredWidthRef = React.useRef(0);
  const renderedChildren = wrapButtonLabels(children);
  const setButtonRef = React.useCallback((node) => {
    internalRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  }, [ref]);

  React.useLayoutEffect(() => {
    const button = internalRef.current;
    if (!button || typeof window === "undefined") return undefined;

    let animationFrame = 0;
    const measure = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const labels = Array.from(button.querySelectorAll('[data-slot="button-label"]'));
        const icons = Array.from(button.querySelectorAll('svg'));
        if (labels.length === 0 || icons.length === 0) {
          delete button.dataset.iconOnly;
          requiredWidthRef.current = 0;
          return;
        }

        const styles = window.getComputedStyle(button);
        const horizontalPadding = (Number.parseFloat(styles.paddingLeft) || 0)
          + (Number.parseFloat(styles.paddingRight) || 0);
        const borderWidth = (Number.parseFloat(styles.borderLeftWidth) || 0)
          + (Number.parseFloat(styles.borderRightWidth) || 0);
        const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;
        const labelWidth = labels.reduce((total, element) => total + element.scrollWidth, 0);
        const iconWidth = icons.reduce((total, element) => total + element.getBoundingClientRect().width, 0);
        const requiredWidth = Math.ceil(horizontalPadding + borderWidth + labelWidth + iconWidth + gap);

        requiredWidthRef.current = requiredWidth;
        button.dataset.iconOnly = button.getBoundingClientRect().width + 1 < requiredWidthRef.current
          ? "true"
          : "false";
      });
    };

    const probeAvailableWidth = () => {
      delete button.dataset.iconOnly;
      measure();
    };

    probeAvailableWidth();
    const buttonObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          if (button.dataset.iconOnly !== "true") measure();
        })
      : null;
    const parentObserver = typeof ResizeObserver === "function" && button.parentElement
      ? new ResizeObserver(probeAvailableWidth)
      : null;
    buttonObserver?.observe(button);
    parentObserver?.observe(button.parentElement);
    window.addEventListener("resize", probeAvailableWidth);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      buttonObserver?.disconnect();
      parentObserver?.disconnect();
      window.removeEventListener("resize", probeAvailableWidth);
    };
  }, [children]);

  return (
    <button
      ref={setButtonRef}
      data-slot="button"
      aria-label={props["aria-label"] || (hasIconLabel ? label : undefined)}
      title={props.title || (hasIconLabel ? label : undefined)}
      className={buttonVariants({ variant, size, className })}
      {...props}
    >
      {renderedChildren}
    </button>
  );
});

Button.displayName = "Button";

export { Button };
// eslint-disable-next-line react-refresh/only-export-components
export { buttonVariants };
