import React from 'react';
import { cn } from './utils';

const Sheet = ({ open, onOpenChange, children }) => (
  <div style={{ display: open ? 'block' : 'none' }}>
    <div className="fixed inset-0 z-50 bg-black/50" onClick={() => onOpenChange(false)} />
    <div className="fixed inset-y-0 right-0 z-50 h-full w-full max-w-sm border-l bg-white p-6 shadow-lg">
      {children}
    </div>
  </div>
);

const SheetTrigger = ({ asChild, children, onClick }) => {
  return React.cloneElement(children, { onClick });
};

const SheetContent = ({ children, className, ...props }) => (
  <div className={cn("h-full", className)} {...props}>
    {children}
  </div>
);

const SheetHeader = ({ className, ...props }) => (
  <div className={cn("mb-4", className)} {...props} />
);

const SheetTitle = ({ className, ...props }) => (
  <h2 className={cn("text-lg font-semibold", className)} {...props} />
);

const SheetDescription = ({ className, ...props }) => (
  <p className={cn("text-sm text-slate-500", className)} {...props} />
);

export { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription };
