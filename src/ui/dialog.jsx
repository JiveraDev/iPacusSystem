import * as React from "react";
import { X } from "lucide-react";

import { hasCancelDismissAction } from "./modalCloseVisibility";
import { cn } from "./utils";

const DialogContext = React.createContext(null);

function Dialog({ open, onOpenChange, children }) {
  return <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>;
}

function DialogContent({ className, children, showClose, ...props }) {
  const context = React.useContext(DialogContext);
  const hasCustomMaxWidth = typeof className === "string" && /(?:^|\s)(?:[\w-]+:)*max-w-/.test(className);
  const shouldShowClose = showClose ?? !hasCancelDismissAction(children);

  if (!context?.open) {
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
        data-slot="dialog-content"
        role="dialog"
        aria-modal="true"
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
  return <h2 className={cn("text-lg font-semibold text-slate-900", className)} {...props} />;
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
  return <p className={cn("text-sm text-slate-600", className)} {...props} />;
}

function DialogFooter({ className, ...props }) {
  return <div className={cn("mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end", className)} {...props} />;
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger };
