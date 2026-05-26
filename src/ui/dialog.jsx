import * as React from "react";

import { cn } from "./utils";

const DialogContext = React.createContext(null);

function Dialog({ open, onOpenChange, children }) {
  return <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>;
}

function DialogContent({ className, children, ...props }) {
  const context = React.useContext(DialogContext);
  const hasCustomMaxWidth = typeof className === "string" && /(?:^|\s)(?:[\w-]+:)*max-w-/.test(className);

  if (!context?.open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        onClick={() => context.onOpenChange?.(false)}
        aria-label="Close dialog"
      />
      <div
        className={cn(
          "relative z-10 max-h-[calc(100vh-1.5rem)] w-full min-w-0 overflow-y-auto overflow-x-hidden rounded-xl bg-white p-4 shadow-xl sm:max-h-[calc(100vh-2rem)] sm:p-6",
          !hasCustomMaxWidth && "max-w-lg",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

function DialogHeader({ className, ...props }) {
  return <div className={cn("mb-4 space-y-1.5", className)} {...props} />;
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
