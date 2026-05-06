import React, { useState, useEffect } from 'react';
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
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      // Small timeout to trigger the entry transition after mount
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      // Wait for the transition to finish before unmounting (300ms matches duration-300)
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!shouldRender) return null;
  
  const sideClasses = {
    right: {
      active: "translate-x-0",
      inactive: "translate-x-full",
      base: "right-0 border-l"
    },
    left: {
      active: "translate-x-0",
      inactive: "-translate-x-full",
      base: "left-0 border-r"
    }
  };

  const currentSide = sideClasses[side] || sideClasses.right;

  return (
    <>
      <div 
        className={cn(
          "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
          isVisible ? "opacity-100" : "opacity-0"
        )} 
        onClick={() => setOpen(false)} 
      />
      <div className={cn(
        "fixed z-50 bg-white p-0 shadow-2xl transition-transform duration-300 ease-in-out",
        side === "right" || side === "left" ? "inset-y-0 w-full sm:max-w-md h-full" : "inset-x-0 h-auto w-full",
        currentSide.base,
        isVisible ? currentSide.active : currentSide.inactive,
        className
      )} {...props}>
        <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={() => setOpen(false)}
              className="rounded-full p-2 hover:bg-slate-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 opacity-70"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
        </div>
        <div className="h-full overflow-y-auto">
          {children}
        </div>
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
