import * as React from "react";

import { cn } from "./utils";

const DialogContext = React.createContext(null);

function Dialog({ open, onOpenChange, children }) {
  return <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>;
}

function DialogContent({ className, children, ...props }) {
  const context = React.useContext(DialogContext);

  if (!context?.open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        onClick={() => context.onOpenChange?.(false)}
        aria-label="Close dialog"
      />
      <div
        className={cn("relative z-10 w-full rounded-xl bg-white p-6 shadow-xl", className)}
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

function DialogDescription({ className, ...props }) {
  return <p className={cn("text-sm text-slate-600", className)} {...props} />;
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription };
