import React, { useState, useEffect } from 'react';
import { hasCancelDismissAction } from './modalCloseVisibility';
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
  const handleClick = (event) => {
    setOpen(true);
    children?.props?.onClick?.(event);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: (e) => {
        children.props.onClick?.(e);
        if (!e.defaultPrevented) {
          setOpen(true);
        }
      },
    });
  }

  return (
    <button type="button" onClick={handleClick}>
      {children}
    </button>
  );
};

const SheetContent = ({ children, side = "right", className, showClose, ...props }) => {
  const { open, setOpen } = React.useContext(SheetContext);
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const shouldShowClose = showClose ?? !hasCancelDismissAction(children);

  useEffect(() => {
    let mountTimer;
    let visibilityTimer;

    if (open) {
      mountTimer = window.setTimeout(() => {
        setShouldRender(true);
        visibilityTimer = window.setTimeout(() => setIsVisible(true), 10);
      }, 0);
    } else {
      mountTimer = window.setTimeout(() => {
        setIsVisible(false);
        visibilityTimer = window.setTimeout(() => setShouldRender(false), 300);
      }, 0);
    }

    return () => {
      window.clearTimeout(mountTimer);
      window.clearTimeout(visibilityTimer);
    };
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
      <div data-slot="sheet-content" role="dialog" aria-modal="true" className={cn(
        "fixed z-50 max-w-full overflow-hidden bg-white p-0 shadow-2xl transition-transform duration-300 ease-in-out",
        side === "right" || side === "left" ? "inset-y-0 h-full w-full sm:max-w-md" : "inset-x-0 h-auto w-full",
        currentSide.base,
        isVisible ? currentSide.active : currentSide.inactive,
        className
      )} {...props}>
        {shouldShowClose && (
        <div className="absolute top-4 right-4 z-10">
            <button 
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close panel"
              className="inline-flex size-9 items-center justify-center rounded-full border border-slate-200 text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-white hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[#155dfc] focus:ring-offset-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
        </div>
        )}
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

const SheetClose = ({ className, children, onClick, ...props }) => {
  const { setOpen } = React.useContext(SheetContext);
  const handleClick = (event) => {
    onClick?.(event);
    if (!event.defaultPrevented) {
      setOpen(false);
    }
  };

  return (
    <button
      {...props}
      type="button"
      className={className}
      onClick={handleClick}
    >
      {children}
    </button>
  );
};

export { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose };
