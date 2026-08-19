import * as React from "react";
import { X } from "lucide-react";

import { hasCancelDismissAction } from "./modalCloseVisibility";
import { cn } from "./utils";

const DialogContext = React.createContext(null);

function Dialog({ open, onOpenChange, children }) {
  const generatedId = React.useId().replace(/:/g, "");
  return (
    <DialogContext.Provider value={{
      open,
      onOpenChange,
      titleId: `dialog-title-${generatedId}`,
      descriptionId: `dialog-description-${generatedId}`,
    }}>
      {children}
    </DialogContext.Provider>
  );
}

function DialogContent({ className, children, showClose, ...props }) {
  const context = React.useContext(DialogContext);
  const isOpen = context?.open;
  const onOpenChange = context?.onOpenChange;
  const contentRef = React.useRef(null);
  const previousFocusRef = React.useRef(null);
  const hasCustomMaxWidth = typeof className === "string" && /(?:^|\s)(?:[\w-]+:)*max-w-/.test(className);
  const shouldShowClose = showClose ?? !hasCancelDismissAction(children);

  React.useEffect(() => {
    if (!isOpen) return undefined;

    previousFocusRef.current = document.activeElement;
    const focusTimer = window.requestAnimationFrame(() => {
      const focusable = contentRef.current?.querySelector(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      (focusable || contentRef.current)?.focus();
    });

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange?.(false);
        return;
      }

      if (event.key !== "Tab" || !contentRef.current) return;

      const focusableElements = Array.from(contentRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((element) => element.getClientRects().length > 0);

      if (focusableElements.length === 0) {
        event.preventDefault();
        contentRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, onOpenChange]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid min-h-dvh w-screen place-items-center overflow-y-auto bg-slate-900/50 scrollbar-hide">
      <button
        type="button"
        tabIndex={-1}
        className="fixed inset-0 cursor-default bg-transparent"
        onClick={() => context.onOpenChange?.(false)}
        aria-label="Close dialog"
      />
      <div
        ref={contentRef}
        data-slot="dialog-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby={context.titleId}
        aria-describedby={context.descriptionId}
        tabIndex={-1}
        className={cn(
          "relative z-10 max-h-[calc(100vh-1.5rem)] w-full min-w-0 overflow-y-auto overflow-x-hidden rounded-xl bg-white p-4 shadow-xl sm:max-h-[calc(100vh-2rem)] sm:p-6 scrollbar-hide",
          !hasCustomMaxWidth && "max-w-lg",
          !shouldShowClose && "[&_[data-slot=dialog-header]]:pr-0",
          className
        )}
        {...props}
      >
        {shouldShowClose && (
          <button
            type="button"
            onClick={() => context.onOpenChange?.(false)}
            aria-label="Close dialog"
            className="absolute right-3 top-3 z-20 inline-flex size-9 items-center justify-center rounded-full border border-slate-200 text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-white hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[#155dfc] focus:ring-offset-2"
          >
            <X className="size-4" strokeWidth={2.5} />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

function DialogHeader({ className, ...props }) {
  return <div data-slot="dialog-header" className={cn("mb-4 space-y-1.5 pr-10", className)} {...props} />;
}

function DialogTitle({ className, ...props }) {
  const context = React.useContext(DialogContext);
  return <h2 id={props.id || context?.titleId} className={cn("text-lg font-semibold text-slate-900", className)} {...props} />;
}

function DialogTrigger({ asChild = false, children, onClick, ...props }) {
  const context = React.useContext(DialogContext);
  const handleClick = (event, childOnClick) => {
    childOnClick?.(event);
    onClick?.(event);

    if (!event.defaultPrevented) {
      context.onOpenChange?.(true);
    }
  };

  if (!asChild) {
    return (
      <button type="button" {...props} onClick={(event) => handleClick(event)}>
        {children}
      </button>
    );
  }

  const child = React.Children.only(children);
  return React.cloneElement(child, {
    ...props,
    onClick: (event) => handleClick(event, child.props.onClick),
  });
}

function DialogDescription({ className, ...props }) {
  const context = React.useContext(DialogContext);
  return <p id={props.id || context?.descriptionId} className={cn("text-sm text-slate-600", className)} {...props} />;
}

function DialogFooter({ className, ...props }) {
  return <div className={cn("mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end", className)} {...props} />;
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger };
