import React, { useState } from 'react';
import { cn } from './utils';

const SheetContext = React.createContext(null);

const Sheet = ({ children }) => {
  const [open, setOpen] = useState(false);
  return (
    <SheetContext.Provider value={{ open, setOpen }}>
      {children}
    </SheetContext.Provider>
  );
};

const SheetTrigger = ({ asChild, children }) => {
  const { setOpen } = React.useContext(SheetContext);
  return React.cloneElement(children, {
    onClick: (e) => {
      children.props.onClick?.(e);
      setOpen(true);
    },
  });
};

const SheetContent = ({ children, side = "right", className, ...props }) => {
  const { open, setOpen } = React.useContext(SheetContext);
  if (!open) return null;
  
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setOpen(false)} />
      <div className={`fixed inset-y-0 ${side}-0 z-50 h-full w-full max-w-sm border-l bg-white p-6 shadow-lg ${className}`}>
        <div className="absolute top-4 right-4">
            <button onClick={() => setOpen(false)}>Close</button>
        </div>
        {children}
      </div>
    </>
  );
};

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
